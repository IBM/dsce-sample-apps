# IBM Bob inside Slack — Seller Demo Script

## 1. The case arrives
**Key message:** With Bob, a case is picked up the moment it arrives — not days later when the admin backlog clears.

- Open the newest case channel in Slack.
- Point at the alert: case number, subject, and the line saying Bob is reading the case and drafting a proposal.
- Narrate: A sales manager filed this — when a deal closes, the Success Plan is created manually days later, handoffs slip, onboarding starts late and renewals suffer.

## 2. Read the proposal
**Key message:** Bob responds like an experienced Salesforce architect because its skills come from IBM's Salesforce practice. Swap in your own skills and Bob responds in your domain.

- Walk through Bob's four parts: the problem, the fix, why it matters, and the skills it applied.

## 3. Push back first
**Key message:** The team can challenge Bob at any point — the answer is specific and contextual, not boilerplate.

- Type: **@bob explain the proposed solution before building it.**
- Bob answers from the case and its own proposal; nothing changes in the org.

## 4. Approve solution
**Key message:** Every action Bob takes is attributed and traceable. Anyone picking up this case later sees what was decided and why — without opening Slack.

- Click **Approve solution**.
- Bob writes a use-case summary and the service posts it on the case in Salesforce.
- Open the link to the case record to show the summary.

## 5. Ask Bob to implement
**Key message:** The change is governed — deploying to the org requires a human approval. The same pattern works for any system with an API or MCP server.

- Type: **@bob implement.**
- The service replies that deploying a change needs approval and shows **Approve deploy** and **Reject**.
- Explain: the change is a new field on the Success Plan object and a flow that creates a Success Plan whenever an opportunity closes as won.

## 6. Approve deploy
**Key message:** Everything is visible and traceable — like any other deployment.

- Click **Approve deploy**.
- The Deployed message lists each component live in the org with direct links into Salesforce Setup, Bob's test steps, and a quick-test link.

## 7. Prove it in Salesforce
**Key message:** Exactly what Bob proposed is now live in the org.

- Open the Meridian Renewal deal, set Stage to **Closed Won**, and save.
- Within seconds the flow creates the Success Plan, fills it with the opportunity details, and notifies the account owner.
- Back in Slack, point at the *It worked* message with the link to the new Success Plan.

## 8. Close
**Key message:** Three approvals, zero code typed, one real change in a live Salesforce org — with every action attributed and traceable. The team defines the skills, approvals, and connected systems.
