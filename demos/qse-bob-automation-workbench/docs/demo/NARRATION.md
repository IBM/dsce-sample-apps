# QSE Workbench demo: narration script

Video: `QSE_Workbench_Demo.mp4` (1280x720, about 2:14). Recorded with `STREAM_MODE=mock`, so every execution shown is the recorded replay, not a live Headless Bob run. Voice: macOS `say`, voice Samantha.

## 0:00 Overview and sign-in

Welcome to the I B M Q S E Automation Workbench. After signing in, the Overview shows the status of Headless Bob, the repository and the Q S E command line tool, plus a getting started checklist. The pink badge shows this demo runs in mock mode, replaying a recorded run.

## 0:16 Bob Connection

Step one, Bob Connection. Enter the Headless Bob address and an A P I key. The key is stored encrypted by the backend, and the browser never talks to Headless Bob directly. Save, test, and the status turns to Connected.

## 0:30 Repository Configuration

Step two, Repository Configuration. Paste a GitHub U R L and branch, validate it, then clone into an isolated workspace. Repository scripts are never executed. In demo mode, the recorded repository is used.

## 0:44 QSE Configuration

Step three, Q S E Configuration. The backend discovers the command line tool, or you can enter an absolute path. Select it and validate, and the detected version appears on the right.

## 0:56 Execution Workspace, digital twin and monitor

Now the Execution Workspace. Pre-flight checks confirm everything is ready. Pick a prompt template or reuse an earlier prompt, then start. The pipeline digital twin updates from real step events, showing Git, the Q S E tool and Headless Bob beside the nine steps. The monitor tracks each step with elapsed time and live logs. No percentage is shown, because Headless Bob does not report one. When the analysis finishes, the report is collected.

## 1:27 Execution History

Every execution is saved with its logs and report. Search by prompt, repository or I D, filter by status, and page through results. The demo tag marks recorded data.

## 1:38 Reports

Reports lists every finished report. Open one to read it in tabs: Executive Summary, Findings, Recommendations, Execution Details, Artifacts and Logs. Copy it, or download Markdown, P D F or J S O N.

## 1:53 Settings

Finally, Settings shows the read-only server configuration, such as version, prompt limit, timeout and allowed Git hosts, and lets you change your password or rotate the encryption key.

## 2:04 Wrap-up

That is the Q S E Automation Workbench: connect, clone, validate, run and review, end to end, with secrets protected and every result stored.
