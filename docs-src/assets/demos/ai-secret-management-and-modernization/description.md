## Demo Script — AI Secret Management and Modernization

This demo walks through detecting hardcoded credentials in a Go application,
remediating them using IBM Bob and HashiCorp Vault, and validating the result
with a follow-up Vault Radar scan.

---

**Step 1 — Review the Vulnerable Application**

1. Open the Go application source code in IBM Bob.
2. Highlight the synthetic username and password hardcoded directly in the
   source code.
3. Explain that this pattern is common in inherited or legacy applications and
   represents a significant security and compliance risk.

**Step 2 — Detect the Exposed Secret**

1. Run HashiCorp Vault Radar against the repository.
2. Show how Vault Radar identifies the hardcoded credential and surfaces the
   associated risk score and finding details.
3. Point out the structured output Vault Radar produces — this becomes the
   input for IBM Bob's remediation plan.

**Step 3 — Export the Findings**

1. Download the Vault Radar findings file.
2. Provide the findings to IBM Bob as secure, untracked context (not committed
   to source control).
3. Explain why untracked context is important — sensitive findings should not
   appear in git history.

**Step 4 — Generate the Remediation Plan**

1. In IBM Bob's Advanced mode, ask Bob to analyze the application source and
   the Vault Radar findings.
2. Bob produces a reviewable remediation plan before making any code changes.
3. Walk through the plan — show the proposed Vault paths, KV structure, and
   PKI configuration that Bob intends to create.

**Step 5 — Secure the Credentials**

1. After reviewing and validating the proposed paths and operations, approve
   the Vault MCP Server actions.
2. Bob executes the approved actions to store the credentials and configuration
   in HashiCorp Vault KV.
3. Show the secrets now stored in Vault — accessible only via policy-controlled
   identities, no longer in source code.

**Step 6 — Manage Application Certificates**

1. Use IBM Bob and the Vault MCP Server to configure Vault PKI.
2. Issue a short-lived certificate for the application through the PKI secrets
   engine.
3. Explain the benefit: certificates expire automatically, reducing the blast
   radius of any credential compromise.

**Step 7 — Modernize and Validate the Application**

1. Approve Bob's code changes — the application is refactored to retrieve
   secrets from Vault at runtime using the Vault SDK.
2. Run formatting, unit tests, and API checks to confirm the application
   behaves correctly with the new secret retrieval pattern.
3. Show that no credentials appear anywhere in the updated source code.

**Step 8 — Rotate and Verify**

1. Rotate the secret in Vault and issue a replacement certificate — no source
   code changes required.
2. Rescan the repository with Vault Radar.
3. Show a clean scan result — no hardcoded credentials remain in the current
   application code.
