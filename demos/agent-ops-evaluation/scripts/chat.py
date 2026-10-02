"""Minimal chat helper: python chat.py <agent_name> "<message>" [thread_id]  (uses the ADK's cached token)."""
import json, os, sys, urllib.request, yaml
ENV = os.environ.get("WXO_ENV", "demo")
cfg = yaml.safe_load(open(os.path.expanduser("~/.config/orchestrate/config.yaml")))
URL = cfg["environments"][ENV]["wxo_url"].rstrip("/")
TOK = yaml.safe_load(open(os.path.expanduser("~/.cache/orchestrate/credentials.yaml")))["auth"][ENV]["wxo_mcsp_token"]
H = {"Authorization": f"Bearer {TOK}", "Content-Type": "application/json"}

def agent_id(name):
    req = urllib.request.Request(URL + "/v1/orchestrate/agents", headers=H)
    for a in json.load(urllib.request.urlopen(req, timeout=30)):
        if a["name"] == name:
            return a["id"]
    sys.exit(f"agent {name} not found")

def chat(name, text, thread_id=None, verbose=True):
    body = {"agent_id": agent_id(name), "message": {"role": "user", "content": text}}
    if thread_id:
        body["thread_id"] = thread_id
    req = urllib.request.Request(URL + "/v1/orchestrate/runs?stream=true", data=json.dumps(body).encode(), headers=H)
    final, tid, events = [], thread_id, []
    with urllib.request.urlopen(req, timeout=300) as r:
        for raw in r:
            line = raw.decode().strip()
            if line.startswith("data:"):
                line = line[5:].strip()
            if not line:
                continue
            try:
                ev = json.loads(line)
            except json.JSONDecodeError:
                continue
            et, d = ev.get("event", ""), ev.get("data", {})
            tid = d.get("thread_id") or tid
            events.append(et)
            if verbose and et not in ("message.delta",):
                step = d.get("delta", {}) or {}
                extra = ""
                if et.startswith("run.step"):
                    sd = d.get("step_details") or {}
                    extra = f" {sd.get('type','')} {sd.get('name','')} {json.dumps(sd.get('args', sd.get('content', '')))[:200]}"
                if "error" in json.dumps(d).lower()[:2000] and et != "message.created":
                    extra += " | " + json.dumps(d)[:400]
                print(f"  [{et}]{extra}")
            if et == "message.delta":
                for c in d.get("delta", {}).get("content", []):
                    final.append(c.get("text", ""))
    return "".join(final), tid, events

if __name__ == "__main__":
    name, text = sys.argv[1], sys.argv[2]
    tid = sys.argv[3] if len(sys.argv) > 3 else None
    out, tid, events = chat(name, text, tid)
    print("\n--- thread:", tid)
    print("--- response:\n" + out)
