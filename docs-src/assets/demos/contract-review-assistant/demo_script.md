Jump to: [Contract Reviewer](#part-1--contract-reviewer-persona) · [Data Scientist](#part-2--data-scientist-persona)

---

## Part 1 — Contract Reviewer Persona

Demonstrates how the Contract Reviewer, built on IBM watsonx Orchestrate, compares a vendor contract against the standard template, flags deviations and regenerates a corrected PDF.

**Step 1 — Explore the Standard Template**

1. Open the **Contract Reviewer** interface.
2. In the right-hand panel, review the standard template clauses for active master services agreements.
3. Query specific standard terms through the chat assistant, for example:
   - Look up **payment fee structures** to see exact fee percentages and quarterly schedules.
   - Verify **termination and renewal conditions** before running a multi-clause review.

**Step 2 — Upload the Vendor Contract**

1. Upload the vendor contract PDF.
2. Review the clause index displayed in the left panel.

**Step 3 — Compare Clauses Against the Standard Contract**

1. Use the suggested tabs to evaluate **fee schedules**, **termination terms** and **renewal clauses** individually.
2. Review the exact deviations highlighted by the assistant:
   - Side-by-side variations in payment percentages, notice periods and termination terms.
   - Actionable recommendations for each deviation.

**Step 4 — Regenerate the Corrected PDF**

1. Ask the assistant to regenerate the PDF.
2. Enter **all** to replace every vendor deviation with the standard policy terms.
3. Open the regenerated PDF and confirm that the notice timelines, renewal terms and fee calculations are corrected in the contract text.
4. Back in the workspace, use the download link in the right panel to download the regenerated contract. The link remains active for **one hour**.

---

## Part 2 — Data Scientist Persona

Demonstrates the governance and evaluation suite powered by IBM watsonx Orchestrate, used to monitor and validate the agent.

**Step 5 — Open the Governance & Evaluation Workspace**

1. Switch to the **Data Scientist** view and open the **Governance & Evaluation** tab.
2. Review model performance, journey success rates and tool invocation metrics.

**Step 6 — Manage Test Cases**

1. View and manage the available test cases.
2. Scroll through the test parameters, including scenario metadata and evaluation goals.
3. Convert real chat threads into evaluation test cases, or upload new test suites as **JSON** or **ZIP** files.

**Step 7 — Run an Evaluation**

1. Inspect the available test cases in the selection modal.
2. Select the scenarios and trigger an evaluation run across the suite.

**Step 8 — Review Run History and Failures**

1. Open the evaluation run history table to see past executions, journey success rates and tool recall scores.
2. Open a previous run that flagged failed test cases and expand the breakdown panel.
3. Read the reasoning: an instruction tweak in the prompt caused an unexpected parameter to be passed, leading to tool routing errors.

**Step 9 — Review Agent Runtime Analytics**

1. Open the agent runtime analytics section.
2. Review total token usage, the prompt versus completion breakdown, average response latency and execution logs across recent runs.

**Step 10 — Confirm the Fix**

1. When the running evaluation completes, review the results.
2. Confirm the **100 percent pass rate** across all test cases, showing that the fix to the agent instructions resolved the earlier issues.

By unifying interactive contract comparison for reviewers with automated governance and telemetry for data scientists, the solution delivers enterprise-grade accuracy, transparency and compliance at scale.
