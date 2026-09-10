"""Shared watsonx AI helpers: IAM token management, text generation, embeddings.

This module is the single source-of-truth for every WatsonX API call across
all services. No other module should call IBM IAM or WatsonX endpoints directly.

Usage::

    from shared.watsonx import WatsonXClient
    wx = WatsonXClient()
    embedding = wx.embed(["text to embed"])[0]
    answer    = wx.generate("Your prompt here")
"""

from __future__ import annotations

import time
from typing import Optional

import requests

from shared.config import watsonx as cfg
from shared.logging import get_logger

logger = get_logger(__name__)

_IAM_TOKEN_URL = "https://iam.cloud.ibm.com/identity/token"


class WatsonXClient:
    """Thread-safe WatsonX client with automatic IAM token refresh.

    One instance per process is sufficient — the token is cached until it
    is within 5 minutes of expiry, then refreshed transparently.
    """

    def __init__(self) -> None:
        self._access_token: Optional[str] = None
        self._token_expiry: float = 0.0
        logger.info(
            "WatsonX client initialised",
            extra={
                "model": cfg.model_id,
                "embedding_model": cfg.embedding_model_id,
                "url": cfg.url,
            },
        )

    # ── IAM token ─────────────────────────────────────────────────────────────

    def _get_token(self) -> str:
        """Return a valid IAM access token, refreshing if necessary."""
        if self._access_token and time.time() < self._token_expiry:
            return self._access_token

        response = requests.post(
            _IAM_TOKEN_URL,
            data={
                "grant_type": "urn:ibm:params:oauth:grant-type:apikey",
                "apikey": cfg.api_key,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=30,
        )
        response.raise_for_status()
        payload = response.json()
        self._access_token = payload["access_token"]
        # Refresh 5 minutes before actual expiry
        self._token_expiry = time.time() + payload["expires_in"] - 300
        logger.debug("IAM access token refreshed")
        return self._access_token  # type: ignore[return-value]

    # ── Text generation ───────────────────────────────────────────────────────

    def generate(
        self,
        prompt: str,
        *,
        system_message: Optional[str] = None,
        max_new_tokens: int = 1024,
        temperature: float = 0.7,
        top_p: float = 0.9,
        top_k: int = 50,
        repetition_penalty: float = 1.1,
        stop_sequences: Optional[list[str]] = None,
    ) -> str:
        """Generate text with the configured LLM.

        Uses the /ml/v1/text/chat endpoint (required for granite-3-x and all
        chat-tuned models). The older /ml/v1/text/generation endpoint is
        deprecated and returns 404 for newer models.

        Args:
            prompt:            Full prompt string sent to the model.
            max_new_tokens:    Upper bound on generated tokens.
            temperature:       Sampling temperature.
            top_p:             Nucleus sampling probability.
            top_k:             Top-K sampling.
            repetition_penalty: Penalty for token repetition.
            stop_sequences:    Sequences that halt generation early.

        Returns:
            The generated text string.

        Raises:
            requests.HTTPError: On non-2xx responses from WatsonX.
        """
        token = self._get_token()
        params: dict = {
            "max_new_tokens": max_new_tokens,
            "temperature": temperature,
            "top_p": top_p,
            "top_k": top_k,
            "repetition_penalty": repetition_penalty,
        }
        if stop_sequences:
            params["stop_sequences"] = stop_sequences

        messages = []
        if system_message:
            messages.append({"role": "system", "content": system_message})
        messages.append({"role": "user", "content": prompt})

        response = requests.post(
            f"{cfg.url}/ml/v1/text/chat?version=2023-05-29",
            json={
                "messages": messages,
                "model_id": cfg.model_id,
                "project_id": cfg.project_id,
                "parameters": params,
            },
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            timeout=60,
        )
        response.raise_for_status()
        result = response.json()
        choice = result["choices"][0]
        usage  = result.get("usage", {})
        logger.debug(
            "Text generated",
            extra={
                "input_tokens":  usage.get("prompt_tokens"),
                "output_tokens": usage.get("completion_tokens"),
            },
        )
        return choice["message"]["content"]

    # ── Embeddings ────────────────────────────────────────────────────────────

    def embed(self, texts: list[str]) -> list[list[float]]:
        """Generate embeddings for a list of texts.

        Args:
            texts: Non-empty list of strings to embed.

        Returns:
            A list of float vectors in the same order as *texts*.
        """
        if not texts:
            return []

        token = self._get_token()
        # Truncate each text to 450 chars to stay under the 512-token model limit
        safe_texts = [t[:450] for t in texts]

        response = requests.post(
            f"{cfg.url}/ml/v1/text/embeddings?version=2023-05-29",
            json={
                "inputs": safe_texts,
                "model_id": cfg.embedding_model_id,
                "project_id": cfg.project_id,
            },
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            timeout=60,
        )
        response.raise_for_status()
        embeddings = [r["embedding"] for r in response.json()["results"]]
        logger.debug(
            "Embeddings generated",
            extra={
                "count": len(embeddings),
                "dimension": len(embeddings[0]) if embeddings else 0,
            },
        )
        return embeddings

    def embed_batched(self, texts: list[str], batch_size: int = 16) -> list[list[float]]:
        """Embed texts in batches to respect API rate limits.

        Args:
            texts:      All texts to embed.
            batch_size: Number of texts per API call.

        Returns:
            Flat list of embedding vectors matching the order of *texts*.
        """
        results: list[list[float]] = []
        for i in range(0, len(texts), batch_size):
            batch = texts[i : i + batch_size]
            results.extend(self.embed(batch))
            if i + batch_size < len(texts):
                time.sleep(0.2)  # courtesy delay between API calls
        return results

    # ── Routing ───────────────────────────────────────────────────────────────

    def route_query(self, query: str) -> dict:
        """Use the LLM to decide which data sources to call for a given query.

        Also detects WRITE intent (update/create/delete) and extracts the
        fields the user wants to change.

        The prompt uses the /ml/v1/text/chat messages format which works for
        all supported instruct/chat models (llama-3-3-70b-instruct etc.).

        Returns:
            Dict with keys:
                ``use_maximo``       (bool)
                ``use_documents``    (bool)
                ``use_web``          (bool)
                ``intent``           ("read" | "update" | "create" | "delete")
                ``object_structure`` (str | None)
                ``record_id``        (str | None)  — ID of the record to update
                ``update_fields``    (dict | None) — fields to write
                ``reason``           (str)
        """
        system_content = (
            "You are a routing assistant for a Maximo asset management knowledge hub.\n"
            "You decide which data sources to query AND whether the user wants to read or write data.\n\n"
            "Available sources:\n"
            "1. MAXIMO_API — live Maximo REST API. Use when the question is about:\n"
            "   - Real-time asset status, work orders, service requests, locations\n"
            "   - Counts, lists, or current state of Maximo records\n"
            "   - Specific asset or WO numbers (e.g. PUMP-1001, WO 1002)\n"
            "   - Updating, changing, or modifying a Maximo record\n"
            "2. DOCUMENTS — uploaded maintenance PDFs and manuals. Use when:\n"
            "   - Question asks how to do a maintenance procedure\n"
            "   - Troubleshooting a specific piece of equipment\n"
            "   - Asking about SOPs, safety procedures, or equipment manuals\n"
            "3. WEB_KNOWLEDGE — crawled IBM documentation. Use when:\n"
            "   - Question is about Maximo software configuration or navigation\n"
            "   - General IBM Maximo product how-to guides or best practices\n\n"
            "Intent types:\n"
            "- 'read'   — user wants to find, list, show, or get information\n"
            "- 'update' — user wants to change, update, set, or modify a field on an existing record\n"
            "- 'create' — user wants to create a new record\n"
            "- 'delete' — user wants to delete or remove a record\n\n"
            "Object structures:\n"
            "  MXAPIWODETAIL — work orders (fields: wonum, wopriority, description, status, assetnum, schedstart, schedfinish)\n"
            "  MXAPIASSET    — assets       (fields: assetnum, description, status, priority, location)\n"
            "  MXAPISR       — service requests (fields: ticketid, description, status, priority)\n"
            "  MXAPIINCIDENT — incidents    (fields: ticketid, description, status, priority)\n"
            "  MXAPILOCATION — locations    (fields: location, description, status)\n\n"
            "Rules:\n"
            "- You MUST respond with ONLY valid JSON — no explanation, no markdown, no extra text.\n"
            "- For 'update' intent: extract record_id (the ID value), and update_fields as a JSON object\n"
            "  with the EXACT Maximo field names. Priority fields: wopriority (WO), priority (asset/SR).\n"
            "- update_fields values must be the correct type (int for priority, string for text fields).\n"
            "- If intent is not 'update', set record_id and update_fields to null.\n"
        )
        user_content = (
            f"User request: {query}\n\n"
            "Respond with ONLY this JSON:\n"
            '{"use_maximo": true/false, "use_documents": true/false, "use_web": true/false, '
            '"intent": "read|update|create|delete", '
            '"object_structure": "MXAPI..." or null, '
            '"record_id": "value" or null, '
            '"update_fields": {...} or null, '
            '"reason": "one sentence"}'
        )

        raw = ""
        try:
            raw = self.generate(
                user_content,
                system_message=system_content,
                max_new_tokens=150,
                temperature=0.0,   # deterministic routing
                top_p=1.0,
                top_k=1,
                repetition_penalty=1.0,
            ).strip()
            logger.info("LLM routing raw response", extra={"raw": raw})

            import re as _re
            import json as _json
            json_match = _re.search(r'\{.*\}', raw, _re.DOTALL)
            if not json_match:
                raise ValueError("No JSON object found in LLM response")
            decision = _json.loads(json_match.group())

            result = {
                "use_maximo":       bool(decision.get("use_maximo", False)),
                "use_documents":    bool(decision.get("use_documents", False)),
                "use_web":          bool(decision.get("use_web", False)),
                "intent":           decision.get("intent", "read"),
                "object_structure": decision.get("object_structure") or None,
                "record_id":        str(decision["record_id"]) if decision.get("record_id") else None,
                "update_fields":    decision.get("update_fields") or None,
                "reason":           decision.get("reason", "LLM routing decision"),
            }
            logger.info(
                "LLM routing decision",
                extra={
                    "intent": result["intent"],
                    "use_maximo": result["use_maximo"],
                    "use_documents": result["use_documents"],
                    "use_web": result["use_web"],
                    "object_structure": result["object_structure"],
                    "record_id": result["record_id"],
                    "update_fields": result["update_fields"],
                    "reason": result["reason"],
                },
            )
            return result

        except Exception as exc:
            logger.warning(
                "LLM routing failed — falling back to safe defaults",
                extra={"error": str(exc), "raw": raw},
            )
            return {
                "use_maximo": False, "use_documents": True, "use_web": True,
                "intent": "read", "object_structure": None,
                "record_id": None, "update_fields": None,
                "reason": f"Fallback (LLM error: {exc})",
            }

    # ── RAG convenience ───────────────────────────────────────────────────────

    def generate_rag_response(self, query: str, search_results: list[dict]) -> str:
        """Generate a RAG answer grounded in *search_results*."""
        context = "\n\n---\n\n".join(
            f"Document {i + 1} ({r['fileName']}, Score: {r.get('score', 'N/A')}):\n{r['content']}"
            for i, r in enumerate(search_results)
        )
        return self.generate(
            f"{query}\n\nDOCUMENTATION:\n{context}",
            system_message=(
                "You are an expert maintenance assistant for IBM Maximo. "
                "Answer ONLY from the documentation provided. "
                "Give clear, step-by-step guidance. Cite the document name."
            ),
            max_new_tokens=1500,
            temperature=0.3,
            top_p=0.85,
        )


# Module-level singleton — import and reuse this instance across services.
client = WatsonXClient()
