"""watsonx Orchestrate access: IAM token cache, agent lookup, streamed chat runs, platform traces."""

from __future__ import annotations

import asyncio
import json
import logging
import time
from datetime import datetime, timedelta, timezone
from typing import AsyncIterator

import httpx

from . import config

log = logging.getLogger("agentops_d1.wxo")

HANDOFF_PREFIX = "chat_with_collaborator_"


class WxoClient:
    def __init__(self) -> None:
        self._token: str | None = None
        self._expires_at: float = 0.0
        self._lock = asyncio.Lock()
        self._agent_ids: dict[str, str] = {}
        self._http = httpx.AsyncClient(timeout=httpx.Timeout(30.0, read=300.0))

    async def close(self) -> None:
        await self._http.aclose()

    # -- auth -------------------------------------------------------------
    async def token(self) -> str:
        if self._token and time.time() < self._expires_at - 120:
            return self._token
        async with self._lock:
            if self._token and time.time() < self._expires_at - 120:
                return self._token
            resp = await self._http.post(
                config.IAM_TOKEN_URL,
                data={"grant_type": "urn:ibm:params:oauth:grant-type:apikey", "apikey": config.WXO_API_KEY},
                headers={"Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json"},
            )
            resp.raise_for_status()
            data = resp.json()
            self._token = data["access_token"]
            self._expires_at = time.time() + int(data.get("expires_in", 3600))
            return self._token

    async def _headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {await self.token()}", "Content-Type": "application/json"}

    # -- agents -----------------------------------------------------------
    async def agent_id(self, name: str) -> str:
        if name in self._agent_ids:
            return self._agent_ids[name]
        resp = await self._http.get(f"{config.WXO_INSTANCE_URL}/v1/orchestrate/agents", headers=await self._headers())
        resp.raise_for_status()
        for agent in resp.json():
            if agent.get("name") == name:
                self._agent_ids[name] = agent["id"]
                return agent["id"]
        raise LookupError(f"agent {name} not found on the instance")

    # -- chat -------------------------------------------------------------
    async def stream_run(self, agent_name: str, text: str) -> AsyncIterator[dict]:
        """Run one message against an agent and yield normalized events.

        Event types: agent, tool_call, tool_response, delta, usage, done, error.
        Every event carries t (ms since the run started).
        """
        body = {"agent_id": await self.agent_id(agent_name), "message": {"role": "user", "content": text}}
        started = time.monotonic()
        t = lambda: int((time.monotonic() - started) * 1000)  # noqa: E731
        current_agent: str | None = None
        thread_id = trace_id = None
        final_text: list[str] = []

        async with self._http.stream(
            "POST", f"{config.WXO_INSTANCE_URL}/v1/orchestrate/runs?stream=true",
            headers=await self._headers(), json=body,
        ) as resp:
            if resp.status_code >= 400:
                await resp.aread()
                log.warning("run request failed: %s", resp.status_code)
                yield {"type": "error", "message": "The agent could not be reached. Please try again.", "t": t()}
                return
            async for raw in resp.aiter_lines():
                line = raw.strip()
                if line.startswith("data:"):
                    line = line[5:].strip()
                if not line:
                    continue
                try:
                    ev = json.loads(line)
                except json.JSONDecodeError:
                    continue
                kind, data = ev.get("event", ""), ev.get("data", {}) or {}
                thread_id = data.get("thread_id") or thread_id

                if kind == "run.step.intermediate":
                    agent = data.get("current_agent")
                    if agent and agent != current_agent:
                        current_agent = agent
                        yield {"type": "agent", "agent": agent, "t": t()}

                elif kind == "run.step.delta":
                    for step in (data.get("delta") or {}).get("step_details") or []:
                        stype = step.get("type")
                        if stype == "tool_calls":
                            agent = step.get("agent_display_name") or current_agent
                            for call in step.get("tool_calls") or []:
                                name = call.get("name", "")
                                yield {
                                    "type": "tool_call", "agent": agent, "name": name, "id": call.get("id"),
                                    "handoff": name.startswith(HANDOFF_PREFIX),
                                    "args": call.get("args"), "t": t(),
                                }
                        elif stype == "tool_response":
                            content = step.get("content")
                            if isinstance(content, str):
                                try:
                                    content = json.loads(content)
                                except json.JSONDecodeError:
                                    pass
                            yield {"type": "tool_response", "name": step.get("name"), "id": step.get("tool_call_id"),
                                   "content": content, "t": t()}

                elif kind == "message.delta":
                    for chunk in (data.get("delta") or {}).get("content") or []:
                        text_chunk = chunk.get("text")
                        if text_chunk:
                            final_text.append(text_chunk)
                            yield {"type": "delta", "text": text_chunk, "t": t()}

                elif kind == "message.created":
                    trace_id = data.get("trace_id") or trace_id
                    if not final_text:
                        for chunk in (data.get("message") or {}).get("content") or []:
                            if chunk.get("response_type") == "text" and chunk.get("text"):
                                final_text.append(chunk["text"])
                                yield {"type": "delta", "text": chunk["text"], "t": t()}

                elif kind == "message.completed":
                    usage = data.get("usage") or {}
                    yield {
                        "type": "usage", "t": t(),
                        "total": (usage.get("token_usage") or {}).get("total_tokens"),
                        "models": [
                            {"model": m.get("model_name"), "provider": m.get("provider"),
                             "prompt_tokens": (m.get("token_usage") or {}).get("prompt_tokens"),
                             "completion_tokens": (m.get("token_usage") or {}).get("completion_tokens"),
                             "total_tokens": (m.get("token_usage") or {}).get("total_tokens")}
                            for m in usage.get("model_usage") or []
                        ],
                    }

                elif kind in ("run.completed", "done"):
                    yield {"type": "done", "thread_id": thread_id, "trace_id": trace_id, "t": t(),
                           "text": "".join(final_text)}
                    return

                elif kind == "run.failed" or kind.endswith(".error"):
                    log.warning("run reported failure: %s", kind)
                    yield {"type": "error", "message": "The run did not complete. Please try again.", "t": t()}
                    return

        yield {"type": "done", "thread_id": thread_id, "trace_id": trace_id, "t": t(), "text": "".join(final_text)}

    # -- traces -----------------------------------------------------------
    async def trace(self, trace_id: str) -> dict:
        """Fetch the platform trace (observations) for a run and reduce it to a span tree."""
        now = datetime.now(timezone.utc)
        params = {
            "traceId": trace_id, "page": 1, "limit": 500,
            "fromStartTime": (now - timedelta(hours=3)).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "toStartTime": (now + timedelta(minutes=5)).strftime("%Y-%m-%dT%H:%M:%SZ"),
        }
        resp = await self._http.get(f"{config.WXO_INSTANCE_URL}/v1/agentops-v3/observations",
                                    params=params, headers=await self._headers())
        if resp.status_code == 429:
            raise RuntimeError("rate_limited")
        resp.raise_for_status()
        obs = resp.json().get("data") or []
        return _reduce_trace(obs)


def _reduce_trace(observations: list[dict]) -> dict:
    """Keep the spans a visitor cares about: agents, handoffs, tools, generations; add tokens and latency."""
    spans = []
    tokens_by_model: dict[str, dict[str, int]] = {}
    total_latency = 0.0
    for o in observations:
        name, otype = o.get("name") or "", o.get("type") or ""
        if otype == "GENERATION":
            kind = "generation"
        elif name.startswith(HANDOFF_PREFIX):
            kind = "handoff"
        elif name.startswith("agentops_d1_") and otype == "SPAN":
            kind = "tool"
        elif name == "LangGraph":
            kind = "root"
        else:
            continue
        usage = o.get("usage") or {}
        span = {
            "id": o.get("id"), "parent": o.get("parentObservationId"), "kind": kind,
            "name": name if kind != "generation" else (o.get("model") or name),
            "start": o.get("startTime"), "end": o.get("endTime"), "latency_ms": o.get("latency"),
            "input_tokens": usage.get("input") or 0, "output_tokens": usage.get("output") or 0,
        }
        if kind == "generation":
            model = o.get("model") or "unknown"
            agg = tokens_by_model.setdefault(model, {"input": 0, "output": 0, "calls": 0})
            agg["input"] += span["input_tokens"]
            agg["output"] += span["output_tokens"]
            agg["calls"] += 1
        if kind == "root":
            total_latency = o.get("latency") or 0.0
        spans.append(span)
    # de-duplicate tool spans: the runtime records the same tool twice (invoke + execute)
    deduped: list[dict] = []
    for s in spans:
        if s["kind"] == "tool" and any(
            d["kind"] == "tool" and d["name"] == s["name"] and abs(_ms_between(d["start"] or "", s["start"] or "")) < 2000
            for d in deduped
        ):
            continue
        deduped.append(s)
    starts = [s["start"] for s in deduped if s.get("start")]
    ends = [s["end"] for s in deduped if s.get("end")]
    if not total_latency and starts and ends:
        total_latency = _ms_between(min(starts), max(ends))
    complete = any(s["kind"] == "root" for s in deduped)
    return {"spans": deduped, "tokens_by_model": tokens_by_model, "observations": len(observations),
            "latency_ms": total_latency, "complete": complete}


def _ms_between(start_iso: str, end_iso: str) -> float:
    try:
        fmt = "%Y-%m-%dT%H:%M:%S.%f"
        a = datetime.strptime(start_iso[:26].rstrip("Z"), fmt)
        b = datetime.strptime(end_iso[:26].rstrip("Z"), fmt)
        return round((b - a).total_seconds() * 1000)
    except ValueError:
        return 0.0
