"""Loan underwriting tools for the Agent Ops evaluation demo.

All data is fictitious and deterministic so that evaluation runs are repeatable.
"""

from ibm_watsonx_orchestrate.agent_builder.tools import tool

# ---------------------------------------------------------------------------
# Fictitious applicant profiles used by the credit, sanctions and AML mocks.
# Names not listed here fall back to a neutral default profile.
# ---------------------------------------------------------------------------
_CREDIT_PROFILES = {
    "sarah chen":      {"credit_score": 762, "derogatory_marks": 0, "utilization_pct": 18, "bankruptcies": 0},
    "marcus reyes":    {"credit_score": 721, "derogatory_marks": 1, "utilization_pct": 27, "bankruptcies": 0},
    "elena volkova":   {"credit_score": 745, "derogatory_marks": 0, "utilization_pct": 22, "bankruptcies": 0},
    "david park":      {"credit_score": 588, "derogatory_marks": 3, "utilization_pct": 64, "bankruptcies": 0},
    "priya natarajan": {"credit_score": 688, "derogatory_marks": 1, "utilization_pct": 41, "bankruptcies": 0},
}
_DEFAULT_CREDIT = {"credit_score": 700, "derogatory_marks": 1, "utilization_pct": 30, "bankruptcies": 0}

_SANCTIONED_NAMES = {"elena volkova"}

_AML_HIGH_RISK_NAMES: set = set()
_AML_MEDIUM_RISK_NAMES = {"marcus reyes", "priya natarajan"}


def _application_id(applicant_name: str) -> str:
    # Stable, human-readable id derived from the name (not a hash of PII).
    initials = "".join(part[0] for part in applicant_name.split() if part).upper()
    return f"APP-{initials}-{len(applicant_name) * 37 % 1000:03d}"


@tool
def agentops_d1_validate_application(
    applicant_name: str,
    annual_income: int,
    loan_amount: int,
    employment_type: str,
    monthly_debt_payments: int,
) -> dict:
    """Validate a loan application and compute the debt-to-income (DTI) ratio.

    Checks that the required fields are present and within eligibility bounds,
    estimates the proposed monthly payment as loan_amount / 360, and returns the
    application id, validation status, DTI percentage and any errors or warnings.

    Args:
        applicant_name (str): Full legal name of the applicant.
        annual_income (int): Gross annual income in USD.
        loan_amount (int): Requested loan amount in USD.
        employment_type (str): One of salaried, self_employed, retired, unemployed.
        monthly_debt_payments (int): Total existing monthly debt payments in USD.

    Returns:
        dict: application_id, status (VALID or INVALID), dti_pct, dti_category, errors, warnings.
    """
    errors, warnings = [], []
    employment_type = (employment_type or "").strip().lower()
    if employment_type not in {"salaried", "self_employed", "retired", "unemployed"}:
        errors.append(f"employment_type '{employment_type}' is not recognised")
    if annual_income < 20000:
        errors.append("annual_income below the 20,000 USD minimum")
    if loan_amount < 5000 or loan_amount > 2000000:
        errors.append("loan_amount outside the 5,000 to 2,000,000 USD range")
    if employment_type == "unemployed":
        errors.append("applicant must have a verifiable income source")
    if loan_amount > annual_income * 5:
        warnings.append("loan amount exceeds five times annual income")

    monthly_income = max(annual_income, 1) / 12
    proposed_payment = loan_amount / 360
    dti_pct = round((monthly_debt_payments + proposed_payment) / monthly_income * 100, 1)
    if dti_pct <= 36:
        dti_category = "LOW"
    elif dti_pct <= 43:
        dti_category = "ELEVATED"
    else:
        dti_category = "HIGH"
        warnings.append("DTI above 43 percent")

    return {
        "application_id": _application_id(applicant_name),
        "status": "INVALID" if errors else "VALID",
        "dti_pct": dti_pct,
        "dti_category": dti_category,
        "proposed_monthly_payment": round(proposed_payment, 2),
        "errors": errors,
        "warnings": warnings,
    }


@tool
def agentops_d1_credit_bureau_lookup(applicant_name: str) -> dict:
    """Retrieve a credit bureau summary for an applicant.

    Returns the credit score, number of derogatory marks, revolving utilization
    percentage and bankruptcies, together with a PASS / REFER / FAIL band based
    on standard underwriting thresholds (score 700+ PASS, 620 to 699 REFER, below 620 FAIL).

    Args:
        applicant_name (str): Full legal name of the applicant.

    Returns:
        dict: credit_score, derogatory_marks, utilization_pct, bankruptcies, band, risk_factors.
    """
    profile = dict(_CREDIT_PROFILES.get(applicant_name.strip().lower(), _DEFAULT_CREDIT))
    score = profile["credit_score"]
    band = "PASS" if score >= 700 else "REFER" if score >= 620 else "FAIL"
    factors = []
    if score < 620:
        factors.append(f"credit score {score} is below the 620 minimum")
    elif score < 700:
        factors.append(f"credit score {score} is below the 700 prime threshold")
    if profile["derogatory_marks"] >= 2:
        factors.append(f"{profile['derogatory_marks']} derogatory marks on file")
        band = "FAIL" if profile["derogatory_marks"] >= 4 else band if band == "FAIL" else "REFER"
    if profile["utilization_pct"] > 50:
        factors.append(f"revolving utilization at {profile['utilization_pct']} percent")
        band = "FAIL" if band == "FAIL" else "REFER"
    if profile["bankruptcies"]:
        factors.append("bankruptcy within the last seven years")
        band = "FAIL"
    profile.update({"applicant_name": applicant_name, "band": band, "risk_factors": factors})
    return profile


@tool
def agentops_d1_sanctions_check(applicant_name: str) -> dict:
    """Screen an applicant against the sanctions watch list.

    Args:
        applicant_name (str): Full legal name of the applicant.

    Returns:
        dict: applicant_name, is_sanctioned (bool), result (CLEAR or MATCH), note.
    """
    hit = applicant_name.strip().lower() in _SANCTIONED_NAMES
    return {
        "applicant_name": applicant_name,
        "is_sanctioned": hit,
        "result": "MATCH" if hit else "CLEAR",
        "note": "Name matches a sanctions list entry; application must be blocked." if hit
                else "No sanctions list match found.",
    }


@tool
def agentops_d1_aml_screening(applicant_name: str, employment_type: str, loan_amount: int) -> dict:
    """Run anti-money-laundering (AML) risk screening for an applicant.

    Scores the applicant LOW, MEDIUM or HIGH based on the applicant profile,
    employment type and loan size. MEDIUM requires manual review; HIGH blocks the application.

    Args:
        applicant_name (str): Full legal name of the applicant.
        employment_type (str): One of salaried, self_employed, retired, unemployed.
        loan_amount (int): Requested loan amount in USD.

    Returns:
        dict: applicant_name, risk_level (LOW, MEDIUM or HIGH), risk_score, risk_factors.
    """
    key = applicant_name.strip().lower()
    factors = []
    score = 10
    if key in _AML_HIGH_RISK_NAMES:
        score += 70
        factors.append("adverse media match")
    if key in _AML_MEDIUM_RISK_NAMES or (employment_type or "").lower() == "self_employed":
        score += 30
        factors.append("self-employed income requires source-of-funds verification")
    if loan_amount >= 500000:
        score += 15
        factors.append("loan amount at or above 500,000 USD")
    level = "HIGH" if score >= 70 else "MEDIUM" if score >= 40 else "LOW"
    return {"applicant_name": applicant_name, "risk_level": level, "risk_score": score, "risk_factors": factors}


@tool
def agentops_d1_generate_decision_letter(applicant_name: str, decision: str, primary_reasons: list[str]) -> str:
    """Generate the formal loan decision letter sent to the applicant.

    Args:
        applicant_name (str): Full legal name of the applicant.
        decision (str): One of APPROVED, CONDITIONAL_APPROVAL, REFERRED, DENIED.
        primary_reasons (list[str]): Two to four specific, factual reasons supporting the decision.

    Returns:
        str: The complete decision letter text, including a letter reference code (DL-...).
    """
    decision = (decision or "").strip().upper()
    headline = {
        "APPROVED": "We are pleased to inform you that your loan application has been approved.",
        "CONDITIONAL_APPROVAL": "Your loan application has been conditionally approved.",
        "REFERRED": "Your loan application has been referred for senior underwriter review.",
        "DENIED": "After careful review, we are unable to approve your loan application at this time.",
    }.get(decision, "Your loan application has been reviewed.")
    reasons = "\n".join(f"  - {r}" for r in (primary_reasons or [])) or "  - See attached assessment."
    reference = f"DL-{_application_id(applicant_name)[4:]}-{decision[:3]}"
    return (
        f"Dear {applicant_name},\n\n{headline}\n\n"
        f"Decision: {decision}\nLetter reference: {reference}\nPrimary factors:\n{reasons}\n\n"
        "You have the right to request the specific reasons for this decision within 60 days.\n\n"
        "Sincerely,\nUnderwriting Department"
    )
