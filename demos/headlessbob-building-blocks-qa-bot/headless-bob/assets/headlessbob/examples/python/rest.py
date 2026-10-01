"""Create/continue a REST thread, stream a reply, and optionally download a file."""
import argparse
from pathlib import Path
from urllib.parse import quote
from uuid import uuid4
from client import api, events, request, show_result, wait_run

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("prompt", nargs="?", default="Create hello.txt containing Hello from headlessbob.")
parser.add_argument("--thread", help="Existing thread ID for a follow-up")
parser.add_argument("--download", help="Relative workspace file path to download after completion")
parser.add_argument("--output", default="downloaded-artifact", help="Local output path; must not exist")
args = parser.parse_args()

thread_id = args.thread or api("/api/v1/threads", {"title": "Python REST example"})["id"]
print("Thread ID:", thread_id, flush=True)
accepted = api(f"/api/v1/threads/{thread_id}/messages", {"content": args.prompt},
               headers={"Idempotency-Key": str(uuid4())})
run_id = accepted["run"]["run_id"]
print("Run ID:", run_id, flush=True)
with request(accepted["events_url"]) as response:
    for event in events(response):
        if event["type"] == "message.part":
            print(event["part"].get("content", ""), end="", flush=True)
print()
show_result(wait_run(f"/api/v1/runs/{run_id}"))
print("Messages:", len(api(f"/api/v1/threads/{thread_id}/messages")["items"]))
print("Files:", [item["path"] for item in api(f"/api/v1/threads/{thread_id}/files")["items"]])
if args.download:
    path = f"/api/v1/threads/{thread_id}/files/download?path={quote(args.download, safe='')}"
    with request(path) as response, Path(args.output).open("xb") as output:
        while chunk := response.read(64 * 1024):
            output.write(chunk)
    print("Downloaded:", args.output)
