"""Cancel an existing run through ACP or REST; then wait for terminal status."""
import argparse
from client import api, wait_run

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("run_id")
parser.add_argument("--api", choices=["acp", "rest"], default="rest")
args = parser.parse_args()
base = "" if args.api == "acp" else "/api/v1"
path = f"{base}/runs/{args.run_id}"
run = api(path + "/cancel", method="POST")
print("Cancellation requested:", run["status"])
print("Final status:", wait_run(path)["status"])
