# Seller & Demo Script: IBM Quantum Safe Explorer Bob Automation Workbench

## Step 1: Introduce the Workbench
* **Show:** The Sign-in page.
* **Say:** "This is the IBM Quantum Safe Explorer Bob Automation Workbench. It runs quantum-safe analysis of a GitHub repository through Headless Bob and the QSE CLI."
* **Action:** Sign in as admin and click Sign in.

## Step 2: Overview
* **Show:** The Overview page with its Getting started list and the header status.
* **Say:** "The Overview lists the steps in order. The header shows this is demo mode: it replays a recording of one real run."
* **Action:** Point at the `STREAM_MODE=mock` tag, then click Bob Connection in the left menu.

## Step 3: Connect Headless Bob
* **Show:** The Bob Connection page.
* **Say:** "First I connect Headless Bob. The backend stores the key encrypted and makes every call itself."
* **Action:** Enter any address and key, click Save configuration, then Test connection. The status turns to Connected.
* **Note:** Mention that in demo mode these values are discarded.

## Step 4: Clone a Repository
* **Show:** The Repository Configuration page.
* **Say:** "Next, a GitHub repository. It is cloned into an isolated workspace, and its scripts are never executed."
* **Action:** Enter a GitHub URL, keep the branch, click Validate repository, then Clone repository.
* **Note:** Demo mode presents the recorded repository, `SunilManika/crypto-inventory-demo`. Nothing is cloned.

## Step 5: Configure the QSE CLI
* **Show:** The QSE Configuration page.
* **Say:** "Then the QSE CLI. The Workbench finds it, validates it, and shows its version."
* **Action:** Keep Automatic discovery, select the candidate, click Use selected and validate.

## Step 6: Describe the Task
* **Show:** The Execution Workspace page and the pre-flight checklist.
* **Say:** "All four checks are green. Now I describe the task in plain language, or pick a template."
* **Action:** Open Prompt template, choose Full quantum-safe assessment, and click Start execution.
* **Note:** The prompt is accepted but not sent anywhere in demo mode.

## Step 7: Watch the Run Live
* **Show:** The Pipeline digital twin and the Execution monitor.
* **Say:** "The pipeline model updates as each step finishes, and Bob's log output streams below. A real run takes about 4 minutes; the demo replays it in about 20 seconds."
* **Action:** Let the steps complete. Point at the log lines as they arrive.

## Step 8: Read the Report
* **Show:** The Report page.
* **Say:** "When it finishes, Bob's end-to-end report is rendered here. In demo mode it carries a DEMO notice at the top."
* **Action:** Open the report from the Execution monitor and scroll through the sections.

## Step 9: Download the Results
* **Show:** The download buttons and the artifacts list.
* **Say:** "I can copy the report or download it as Markdown, PDF or JSON, plus the four scan artifacts."
* **Action:** Click one download, then open Execution History to show the saved run.

**Closing line:** "The Workbench never invents findings. In real mode, the report contains only what Headless Bob returns."
