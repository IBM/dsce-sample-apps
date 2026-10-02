"""Generate the five ground-truth test cases for both orchestrator versions.

Note on argument order: the evaluation framework stops checking arguments at the first
field with "fuzzy" matching, so strict fields are listed before the fuzzy applicant_name.

Run:  python evaluations/make_testcases.py
Writes evaluations/testcases_v1/*.json and evaluations/testcases_v2/*.json.
"""
import json
from pathlib import Path

CASES = [
    dict(id="tc01_clean_approval", name="Sarah Chen", income=95000, loan=250000, debts=1200,
         employment="salaried", decision="APPROVED",
         story_extra="You have been salaried for eight years."),
    dict(id="tc02_self_employed_caution", name="Marcus Reyes", income=120000, loan=300000, debts=1500,
         employment="self_employed", decision="CONDITIONAL_APPROVAL",
         story_extra="You run your own consulting business."),
    dict(id="tc03_sanctions_block", name="Elena Volkova", income=140000, loan=400000, debts=900,
         employment="salaried", decision="DENIED",
         story_extra=""),
    dict(id="tc04_low_credit_denied", name="David Park", income=70000, loan=220000, debts=2400,
         employment="salaried", decision="DENIED",
         story_extra=""),
    dict(id="tc05_self_employed_referred", name="Priya Natarajan", income=85000, loan=350000, debts=1800,
         employment="self_employed", decision="REFERRED",
         story_extra="You are a self-employed freelance designer."),
]

def build(case, agent):
    n = case["name"]
    v = agent.rsplit("_", 1)[-1]  # v1 / v2
    def handoff(step, target):
        return {"type": "tool_call", "name": step, "tool_name": f"chat_with_collaborator_{target}",
                "args": {"message": "IGNORE"}, "arg_matching": {"message": "ignore"}}
    starting = (f"I'd like to apply for a home loan. My name is {n}, I am {case['employment'].replace('_', '-')}, "
                f"my annual income is ${case['income']:,}, I'm requesting ${case['loan']:,} "
                f"and my existing monthly debt payments are ${case['debts']:,}.")
    story = (f"You are {n}, applying for a home loan of ${case['loan']:,}. Your annual income is "
             f"${case['income']:,}, you are {case['employment'].replace('_', '-')} and your existing monthly "
             f"debt payments total ${case['debts']:,}. {case['story_extra']} Provide these details when asked "
             f"and wait for the underwriting decision. Once you have received the decision and the letter, "
             f"the conversation is over: reply END and nothing else.")
    return {
        "agent": agent,
        "starting_sentence": starting,
        "story": story.strip(),
        "max_user_turns": 3,
        "goals": {
            "route_intake": ["validate"],
            "validate": ["route_credit"],
            "route_credit": ["bureau"],
            "bureau": ["route_compliance"],
            "route_compliance": ["sanctions", "aml"],
            "sanctions": ["letter"],
            "aml": ["letter"],
            "letter": ["summarize"],
        },
        "goal_details": [
            handoff("route_intake", "agentops_d1_intake_agent"),
            handoff("route_credit", "agentops_d1_credit_risk_agent"),
            handoff("route_compliance", f"agentops_d1_compliance_agent_{v}"),
            {"type": "tool_call", "name": "validate", "tool_name": "agentops_d1_validate_application",
             "args": {"annual_income": case["income"], "loan_amount": case["loan"],
                      "employment_type": case["employment"], "monthly_debt_payments": case["debts"],
                      "applicant_name": n},
             "arg_matching": {"applicant_name": "fuzzy"}},
            {"type": "tool_call", "name": "bureau", "tool_name": "agentops_d1_credit_bureau_lookup",
             "args": {"applicant_name": n}, "arg_matching": {"applicant_name": "fuzzy"}},
            {"type": "tool_call", "name": "sanctions", "tool_name": "agentops_d1_sanctions_check",
             "args": {"applicant_name": n}, "arg_matching": {"applicant_name": "fuzzy"}},
            {"type": "tool_call", "name": "aml", "tool_name": "agentops_d1_aml_screening",
             "args": {"employment_type": case["employment"], "loan_amount": case["loan"], "applicant_name": n},
             "arg_matching": {"applicant_name": "fuzzy"}},
            {"type": "tool_call", "name": "letter", "tool_name": "agentops_d1_generate_decision_letter",
             "args": {"decision": case["decision"], "primary_reasons": [], "applicant_name": n},
             "arg_matching": {"applicant_name": "fuzzy", "primary_reasons": "ignore"}},
            {"type": "text", "name": "summarize",
             "response": f"Decision for {n}: {case['decision']}.",
             "keywords": [case["decision"]]},
        ],
    }

here = Path(__file__).parent
for v in ("v1", "v2"):
    out = here / f"testcases_{v}"
    out.mkdir(exist_ok=True)
    for c in CASES:
        (out / f"{c['id']}.json").write_text(json.dumps(build(c, f"agentops_d1_loan_orchestrator_{v}"), indent=2) + "\n")
    print(v, "->", len(CASES), "cases in", out)
