"""Print a compact table for the latest run under a results dir:  python summarize.py results/evaluate_v1"""
import csv, glob, os, sys, json
root = sys.argv[1]
run = sorted(glob.glob(os.path.join(root, "*/")))[-1]
rows = list(csv.DictReader(open(os.path.join(run, "summary_metrics.csv"))))
print(run)
print(f"{'case':30} {'success':7} {'routing':7} {'recall':6} {'prec':5} {'missed':6} {'badarg':6} {'text':8} {'steps':5} {'resp_s':6}")
for r in rows:
    print(f"{r['dataset_name']:30} {r['is_success']:7} {r['orchestrate_agent_routing_accuracy']:7} {r['tool_call_recall']:6} {r['tool_call_precision']:5} {r['missed_tool_calls']:6} {r['tool_calls_with_incorrect_parameter']:6} {r['keyword_match']:8} {r['total_steps']:5} {r['average_agent_response_time']:6}")
ok = sum(r['is_success'] == 'True' for r in rows)
print(f"journey success: {ok}/{len(rows)}")
avg = os.path.join(run, "average_metrics.json")
if os.path.exists(avg):
    print("averages:", {k: v for k, v in json.load(open(avg)).items() if isinstance(v, (int, float))})
