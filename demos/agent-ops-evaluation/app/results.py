"""Turn the evaluation framework's output folders into compact JSON for the browser."""

from __future__ import annotations

import csv
import json
from pathlib import Path

from . import config

HANDOFF_PREFIX = "chat_with_collaborator_"


def _num(value: str):
    if value in ("True", "False"):
        return value == "True"
    try:
        return float(value) if "." in value else int(value)
    except (TypeError, ValueError):
        return value


def _latest_run_dir(output_dir: Path) -> Path:
    runs = sorted(p for p in output_dir.iterdir() if p.is_dir() and (p / "summary_metrics.csv").exists())
    if not runs:
        raise FileNotFoundError("no completed run under " + str(output_dir))
    return runs[-1]


def _transcript(messages_file: Path) -> list[dict]:
    """Flatten *.messages.analyze.json (message + reason pairs) into readable steps."""
    if not messages_file.exists():
        return []
    return _steps(json.loads(messages_file.read_text()))


def _transcript_plain(messages_file: Path) -> list[dict]:
    """Red-team transcripts are plain message lists without the analysis wrapper."""
    if not messages_file.exists():
        return []
    return _steps([{"message": m, "reason": None} for m in json.loads(messages_file.read_text())])


def _steps(items: list[dict]) -> list[dict]:
    steps: list[dict] = []
    for item in items:
        msg, reason = item.get("message", {}), item.get("reason") or {}
        mtype, content = msg.get("type"), msg.get("content", "")
        if mtype == "tool_call":
            try:
                call = json.loads(content)
            except (TypeError, json.JSONDecodeError):
                call = {"name": str(content)[:80], "args": {}}
            name = call.get("name", "")
            steps.append({"kind": "handoff" if name.startswith(HANDOFF_PREFIX) else "tool_call",
                          "name": name, "args": call.get("args"), "reason": reason.get("reason"),
                          "expected": reason.get("expected")})
        elif mtype == "tool_response":
            try:
                resp = json.loads(content)
                body = resp.get("content")
                try:
                    body = json.loads(body) if isinstance(body, str) else body
                except json.JSONDecodeError:
                    pass
                steps.append({"kind": "tool_response", "name": resp.get("name"), "content": body})
            except (TypeError, json.JSONDecodeError, AttributeError):
                continue
        else:
            steps.append({"kind": "message", "role": msg.get("role"), "text": content,
                          "reason": reason.get("reason")})
    return steps


def _expected_tools(version: str, case: str) -> list[str]:
    tc = json.loads((config.ROOT / "evaluations" / f"testcases_{version}" / f"{case}.json").read_text())
    return [g["tool_name"] for g in tc["goal_details"] if g.get("type") == "tool_call"]


def _decision_from(steps: list[dict]) -> str | None:
    for s in steps:
        if s["kind"] == "tool_call" and s["name"].endswith("generate_decision_letter"):
            return (s.get("args") or {}).get("decision")
    return None


def parse_evaluate(output_dir: Path, version: str) -> dict:
    run = _latest_run_dir(output_dir)
    rows = list(csv.DictReader(open(run / "summary_metrics.csv", encoding="utf-8")))
    cases = []
    for row in rows:
        case = row["dataset_name"]
        steps = _transcript(run / "messages" / f"{case}.messages.analyze.json")
        called = {s["name"] for s in steps if s["kind"] in ("tool_call", "handoff")}
        wrong_args = {s["name"] for s in steps if s["kind"] == "tool_call" and s.get("reason") == "incorrect parameter"}
        expected = _expected_tools(version, case)
        scenario = config.SCENARIOS.get(case, {})
        cases.append({
            "id": case, "title": scenario.get("title", case), "applicant": scenario.get("applicant"),
            "success": row["is_success"] == "True",
            "routing_f1": _num(row["orchestrate_agent_routing_accuracy"]),
            "tool_recall": _num(row["tool_call_recall"]), "tool_precision": _num(row["tool_call_precision"]),
            "missed_tool_calls": _num(row["missed_tool_calls"]),
            "incorrect_parameters": _num(row["tool_calls_with_incorrect_parameter"]),
            "text_match": row["text_match"], "keyword_match": row["keyword_match"] == "True",
            "total_steps": _num(row["total_steps"]), "avg_response_time_s": _num(row["average_agent_response_time"]),
            "expected_decision": scenario.get("expected_decision"), "actual_decision": _decision_from(steps),
            "missed_tools": [t for t in expected if t not in called],
            "wrong_argument_tools": [t for t in expected if t in wrong_args],
            "steps": steps,
        })
    averages = {}
    avg_file = run / "average_metrics.json"
    if avg_file.exists():
        averages = {k: v for k, v in json.loads(avg_file.read_text()).items() if isinstance(v, (int, float))}
    return {"kind": "evaluate", "version": version, "run_dir": str(run), "cases": cases,
            "journey_success": sum(c["success"] for c in cases), "total": len(cases), "averages": averages}


def parse_rubric(output_dir: Path, version: str) -> dict:
    run = _latest_run_dir(output_dir)
    rows = list(csv.DictReader(open(run / "summary_metrics.csv", encoding="utf-8")))
    criteria = config.CATALOG["rubric_criteria"]
    cases = []
    for row in rows:
        case = row["dataset_name"]
        scenario = config.SCENARIOS.get(case, {})
        cases.append({
            "id": case, "title": scenario.get("title", case), "applicant": scenario.get("applicant"),
            "overall": _num(row.get("overall_score", "0")),
            "criteria": {c: {"passed": _num(row.get(c, "0")) == 1, "comment": row.get(f"{c}_comment", "")}
                         for c in criteria},
        })
    passed = sum(1 for c in cases for v in c["criteria"].values() if v["passed"])
    return {"kind": "rubric", "version": version, "run_dir": str(run), "criteria": criteria, "cases": cases,
            "passed": passed, "total": len(cases) * len(criteria)}


def parse_redteam(output_dir: Path, version: str) -> dict:
    summary = json.loads((output_dir / "attacks_results.json").read_text())
    attacks = []
    for attack_id, meta in config.ATTACKS.items():
        result_file = output_dir / "results" / f"{attack_id}.result.json"
        success = json.loads(result_file.read_text()).get("success") if result_file.exists() else None
        steps = _transcript_plain(output_dir / "messages" / f"{attack_id}.messages.json")
        attacks.append({
            "id": attack_id, "title": meta["title"], "summary": meta["summary"], "succeeded": success,
            "turns": sum(1 for s in steps if s["kind"] == "message" and s.get("role") == "user"),
            "aml_called": any(s["kind"] == "tool_call" and s["name"].endswith("aml_screening") for s in steps),
            "decision": _decision_from(steps), "steps": steps,
        })
    return {"kind": "redteam", "version": version, "run_dir": str(output_dir), "attacks": attacks,
            "succeeded": summary.get("n_on_policy_successful", 0), "total": summary.get("n_on_policy_attacks", 0)}

