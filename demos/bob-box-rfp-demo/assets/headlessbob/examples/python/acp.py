"""Create an ACP run, optionally streaming or continuing a session."""
import argparse
from client import api, events, request, show_result, wait_run

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("prompt", nargs="?", default="Reply with a short hello.")
parser.add_argument("--mode", choices=["sync", "async", "stream"], default="async")
parser.add_argument("--session", help="Session ID from a previous completed run")
args = parser.parse_args()

print("Agents:", [agent["name"] for agent in api("/agents")["agents"]])
body = {"agent_name": "headlessbob", "mode": args.mode,
        "input": [{"role": "user", "parts": [{"content_type": "text/plain", "content": args.prompt}]}]}
if args.session:
    body["session_id"] = args.session
if args.mode == "stream":
    run = None
    with request("/runs", body) as response:
        for event in events(response):
            if "run" in event:
                run = event["run"]
                if event["type"] == "run.created":
                    print("Run ID:", run["run_id"], flush=True)
            if event["type"] == "message.part":
                print(event["part"].get("content", ""), end="", flush=True)
    print()
    if run is None:
        raise SystemExit("Stream ended without a run. Check service status.")
    run = wait_run(f'/runs/{run["run_id"]}')
else:
    run = api("/runs", body)
    print("Run ID:", run["run_id"], flush=True)
    run = wait_run(f'/runs/{run["run_id"]}')
show_result(run)
# Stored events are JSON, unlike the live stream above:
print("Stored events:", len(api(f'/runs/{run["run_id"]}/events')["events"]))
