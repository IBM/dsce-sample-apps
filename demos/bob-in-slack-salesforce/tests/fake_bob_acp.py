#!/usr/bin/env python3
"""Fake `bob acp` server for tests — speaks the empirically-validated protocol.

Behaviors:
- initialize / session/new / session/prompt with agent_message_chunk updates
- "create a file named X containing Y" → session/request_permission (kind=edit);
  if allowed, the file is written
- "fetch url U" → request_permission (kind=fetch)
- "spam permissions N" → N sequential request_permission (kind=execute)
- "SLOW N" → takes N seconds, honoring session/cancel mid-turn
- "FLOOD N" → streams N chunks, honoring session/cancel mid-turn
- other prompts echo "FAKE-OK"; prompts asking about "codeword" echo the
  remembered value from earlier prompts in the same session (memory sim)

Permission options carry the ids Bob Shell 2.0.1 really sends
(allow / allow_always / reject / reject_always). Set FAKE_BOB_OPTION_IDS=custom
to use unfamiliar ids with the same kinds, to prove clients choose by kind.
"""

import json
import os
import re
import select
import sys
import time
from pathlib import Path

memory: dict[str, list[str]] = {}


def send(obj):
    sys.stdout.write(json.dumps(obj) + "\n")
    sys.stdout.flush()


def notify(session_id, update):
    send({"jsonrpc": "2.0", "method": "session/update",
          "params": {"sessionId": session_id, "update": update}})


replies: dict[str, list[str]] = {}      # what the fake said, replayed after session/load
replay_pending: set[str] = set()         # sessions whose next prompt starts with the replay


def chunk(session_id, text):
    replies.setdefault(session_id, []).append(text)
    Path(f".fake-replies-{session_id}.json").write_text(json.dumps(replies[session_id]))
    notify(session_id, {"sessionUpdate": "agent_message_chunk",
                        "content": {"type": "text", "text": text}})


def chunk_replay(session_id, text):
    notify(session_id, {"sessionUpdate": "agent_message_chunk",
                        "content": {"type": "text", "text": text}})


def options():
    custom = os.environ.get("FAKE_BOB_OPTION_IDS") == "custom"
    ids = (("o-allow-once", "o-allow-always", "o-reject-once", "o-reject-always") if custom
           else ("allow", "allow_always", "reject", "reject_always"))
    kinds = ("allow_once", "allow_always", "reject_once", "reject_always")
    names = ("Allow once", "Always allow", "Reject", "Always reject")
    return [{"optionId": i, "name": n, "kind": k} for i, n, k in zip(ids, names, kinds)]


pending_permission: dict[int, dict] = {}
next_out_id = 1000


def request_permission(session_id, title, kind, raw_input=None):
    global next_out_id
    next_out_id += 1
    tool_call = {"toolCallId": f"t{next_out_id}", "title": title, "kind": kind}
    if raw_input is not None:
        tool_call["rawInput"] = raw_input
    send({"jsonrpc": "2.0", "id": next_out_id, "method": "session/request_permission",
          "params": {"sessionId": session_id, "toolCall": tool_call, "options": options()}})
    return next_out_id


def decision_allows(msg):
    outcome = ((msg.get("result") or {}).get("outcome") or {})
    if outcome.get("outcome") == "cancelled":
        return None
    chosen = outcome.get("optionId")
    kind = next((o["kind"] for o in options() if o["optionId"] == chosen), "")
    return kind.startswith("allow")


def cancel_requested(seconds):
    """Wait up to `seconds`; True if a session/cancel arrived meanwhile."""
    deadline = time.monotonic() + seconds
    while True:
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            return False
        ready, _, _ = select.select([sys.stdin], [], [], min(remaining, 0.05))
        if ready:
            line = sys.stdin.readline()
            if line and json.loads(line).get("method") == "session/cancel":
                return True


def finish(msg_id, stop="end_turn"):
    send({"jsonrpc": "2.0", "id": msg_id, "result": {"stopReason": stop}})


def main():
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        msg = json.loads(line)
        method, msg_id = msg.get("method"), msg.get("id")

        if msg_id in pending_permission and "result" in msg:
            ctx = pending_permission.pop(msg_id)
            allowed = decision_allows(msg)
            if allowed is None:                       # client cancelled the turn
                chunk(ctx["sid"], "cancelled")
                finish(ctx["prompt_id"], "cancelled")
                continue
            if ctx["kind"] == "edit":
                if allowed:
                    Path(ctx["path"]).write_text(ctx["content"], encoding="utf-8")
                    chunk(ctx["sid"], f"Created {ctx['path']}")
                else:
                    chunk(ctx["sid"], "Write was rejected by permission policy.")
                finish(ctx["prompt_id"])
            elif ctx["kind"] == "fetch":
                chunk(ctx["sid"], "fetched" if allowed else "fetch was rejected")
                finish(ctx["prompt_id"])
            elif ctx["kind"] == "command":
                chunk(ctx["sid"], "ran" if allowed else "command was rejected")
                finish(ctx["prompt_id"])
            elif ctx["kind"] == "execute":
                ctx["allowed"] += 1 if allowed else 0
                ctx["remaining"] -= 1
                if ctx["remaining"] > 0:
                    pid = request_permission(ctx["sid"], "Running command", "execute")
                    pending_permission[pid] = ctx
                else:
                    chunk(ctx["sid"], f"allowed={ctx['allowed']}")
                    finish(ctx["prompt_id"])
            continue

        if method == "initialize":
            send({"jsonrpc": "2.0", "id": msg_id, "result": {
                "protocolVersion": 1,
                "agentCapabilities": {"loadSession": True},
                "agentInfo": {"name": "fake-bob-acp", "version": "0"}}})
        elif method == "session/new":
            sid = f"fake-session-{os.getpid()}"
            memory[sid] = []
            send({"jsonrpc": "2.0", "id": msg_id, "result": {"sessionId": sid}})
        elif method == "session/load":
            # Persisted history lives in a file next to the workspace so a NEW
            # process can replay it, like Bob's task store does.
            sid = (msg.get("params") or {}).get("sessionId", "")
            store = Path((msg.get("params") or {}).get("cwd", ".")) / f".fake-history-{sid}.json"
            if not store.exists():
                send({"jsonrpc": "2.0", "id": msg_id,
                      "error": {"code": -32602, "message": f"unknown session {sid}"}})
                continue
            memory[sid] = json.loads(store.read_text())
            for prior in memory[sid]:
                notify(sid, {"sessionUpdate": "user_message_chunk",
                             "content": {"type": "text", "text": prior}})
            send({"jsonrpc": "2.0", "id": msg_id, "result": {}})
            # Like Bob 2.0.4: nothing is replayed now; the history comes back as
            # user/agent chunk pairs at the start of the next prompt.
            said = Path((msg.get("params") or {}).get("cwd", ".")) / f".fake-replies-{sid}.json"
            replies[sid] = json.loads(said.read_text()) if said.exists() else []
            replay_pending.add(sid)
        elif method == "session/cancel":
            continue  # nothing in flight
        elif method == "session/prompt":
            params = msg.get("params") or {}
            sid = params.get("sessionId", "")
            text = " ".join(p.get("text", "") for p in params.get("prompt", []))
            if sid in replay_pending:
                replay_pending.discard(sid)
                for prior_prompt, prior_reply in zip(memory.get(sid, []), replies.get(sid, [])):
                    notify(sid, {"sessionUpdate": "user_message_chunk",
                                 "content": {"type": "text", "text": prior_prompt}})
                    chunk_replay(sid, prior_reply)
            memory.setdefault(sid, []).append(text)
            Path(f".fake-history-{sid}.json").write_text(json.dumps(memory[sid]))
            if "STDERR" in text:
                sys.stderr.write("fake diagnostic line\n"); sys.stderr.flush()
            sleep = float(os.environ.get("FAKE_BOB_SLEEP", "0"))
            if sleep:
                time.sleep(sleep)
            slow = re.search(r"\bSLOW (\d+)", text)
            if slow:
                if cancel_requested(int(slow.group(1))):
                    chunk(sid, "cancelled")
                    finish(msg_id, "cancelled")
                else:
                    chunk(sid, "slow done")
                    finish(msg_id)
                continue
            flood = re.search(r"\bFLOOD (\d+)", text)
            if flood:
                for _ in range(int(flood.group(1))):
                    chunk(sid, "x" * 100)
                    if cancel_requested(0.002):
                        finish(msg_id, "cancelled")
                        break
                else:
                    finish(msg_id)
                continue
            build = re.search(r"Implement it now in this SFDX project.*?ending (?:it|its name) with _(\d+)", text, re.S)
            if build:
                case = build.group(1)
                root = Path("force-app/main/default")
                (root / "flows").mkdir(parents=True, exist_ok=True)
                (root / "objects/Success_Plan__c/fields").mkdir(parents=True, exist_ok=True)
                (root / f"flows/Create_Success_Plan_{case}.flow-meta.xml").write_text(
                    '<?xml version="1.0" encoding="UTF-8"?><Flow xmlns="http://soap.sforce.com/2006/04/metadata">'
                    f'<label>Create Success Plan {case}</label><status>Active</status><processType>AutoLaunchedFlow</processType></Flow>\n')
                (root / f"objects/Success_Plan__c/fields/Target_Go_Live_{case}__c.field-meta.xml").write_text(
                    '<?xml version="1.0" encoding="UTF-8"?><CustomField xmlns="http://soap.sforce.com/2006/04/metadata">'
                    f'<fullName>Target_Go_Live_{case}__c</fullName><label>Target Go-Live</label><type>Date</type></CustomField>\n')
                chunk(sid, f"Files written: flows/Create_Success_Plan_{case}.flow-meta.xml, "
                           f"objects/Success_Plan__c/fields/Target_Go_Live_{case}__c.field-meta.xml\n"
                           "Test steps: 1. Open Meridian Renewal. 2. Set Stage to Closed Won and save. "
                           "3. Confirm a Success Plan record appears.")
                finish(msg_id)
                continue
            if "Salesforce rejected the package" in text:
                for path in Path("force-app/main/default/flows").glob("*.flow-meta.xml"):
                    path.write_text(path.read_text().replace("<status>Active</status>", "<status>Active</status><!-- fixed -->"))
                chunk(sid, "fixed: corrected the Flow metadata")
                finish(msg_id)
                continue
            reply_file = os.environ.get("FAKE_BOB_REPLY_FILE")
            if reply_file and Path(reply_file).exists():
                for line in Path(reply_file).read_text(encoding="utf-8").splitlines(keepends=True):
                    chunk(sid, line)
                finish(msg_id)
                continue
            write = re.search(r"file named ([\w.]+) containing (\w+)", text, re.I)
            if write:
                pid = request_permission(sid, f"Writing file {write.group(1)}", "edit")
                pending_permission[pid] = {"sid": sid, "prompt_id": msg_id, "kind": "edit",
                                           "path": write.group(1), "content": write.group(2)}
                continue
            fetch = re.search(r"fetch url (\S+)", text, re.I)
            if fetch:
                pid = request_permission(sid, f"Fetching {fetch.group(1)}", "fetch")
                pending_permission[pid] = {"sid": sid, "prompt_id": msg_id, "kind": "fetch"}
                continue
            cmd = re.search(r"run command (.+)$", text, re.I)
            if cmd:
                pid = request_permission(sid, "Running command", "execute",
                                         raw_input={"command": cmd.group(1)})
                pending_permission[pid] = {"sid": sid, "prompt_id": msg_id, "kind": "command"}
                continue
            spam = re.search(r"spam permissions (\d+)", text, re.I)
            if spam:
                pid = request_permission(sid, "Running command", "execute")
                pending_permission[pid] = {"sid": sid, "prompt_id": msg_id, "kind": "execute",
                                           "remaining": int(spam.group(1)), "allowed": 0}
                continue
            if "codeword" in text.lower() and len(memory[sid]) > 1:
                match = None
                for prior in memory[sid]:
                    found = re.search(r"codeword ([A-Z0-9-]+)", prior)
                    if found:
                        match = found.group(1)
                chunk(sid, match or "UNKNOWN")
            else:
                chunk(sid, "FAKE-")
                chunk(sid, "OK")
            finish(msg_id)


if __name__ == "__main__":
    main()
