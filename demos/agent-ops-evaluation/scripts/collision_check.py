"""Refuse to deploy unprefixed names; report which agentops_d1_ agents already exist (they get updated)."""
import glob, json, subprocess, sys, os, yaml
orc = os.environ.get("ORC", "orchestrate")
out = subprocess.run([orc, "agents", "list", "--verbose"], capture_output=True, text=True)
txt = out.stdout + out.stderr
data = json.loads(txt[txt.index('{\n  "native"'):txt.rindex('}') + 1])
existing = {a["name"] for items in data.values() for a in items}
ours = {yaml.safe_load(open(f))["name"] for f in glob.glob("agents/*.yaml")}
bad = [n for n in ours if not n.startswith("agentops_d1_")]
if bad:
    sys.exit(f"refusing: unprefixed agent names {bad}")
print("agents already on instance (will be UPDATED):", sorted(existing & ours) or "none")
print("agents to be CREATED:", sorted(ours - existing))
