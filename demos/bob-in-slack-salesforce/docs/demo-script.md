# Bob in Slack for Salesforce — demo script

**Length:** 8–10 minutes. **Audience:** sellers, architects, Salesforce admins.
**Setup:** one Slack workspace with the Bob app installed, one Salesforce Developer Edition org, the service running (see the README). Set `HB_ATTRACT_LOOP=1` so a case is always waiting.

## The story in one line

A Salesforce admin gets a request in a case. Bob reads it, designs the change, writes it, and the team approves each step in Slack. The service validates and deploys the change under its own credentials, and rolls it back when the case closes. Bob never holds a password.

## Run of show

1. **The case arrives (30 s).** Open the newest `#case-…` channel. Point out the alert: case number, subject, and "Bob is reading the case and drafting a proposal". Say: this came from Salesforce; nobody typed it here.
2. **The proposal (1 min).** Read Bob's four-part answer: the problem, the proposed fix with real object and field names, why it matters, the skills it applied. Say: Bob looked at the real org through a read-only endpoint before proposing. It is not reciting a script; two runs of the same case give two valid designs.
3. **Ask Bob something (1 min).** Type `@bob what is the business impact?` or `@bob why a Flow and not Apex?`. Say: free-form questions run read-only. Bob cannot change anything from here.
4. **Approve solution (30 s).** Click the button. A use-case summary lands on the case record in Salesforce; open the link to show it: Problem, Affected users, Chosen approach, Acceptance criteria.
5. **Bob builds (1–2 min).** Watch "Building the change" become "Validated against the org" with the exact list of components. Say: Bob wrote Salesforce metadata files in its own workspace; the service packaged them and asked Salesforce to validate without deploying. If validation fails, the errors go back to Bob to fix, and you'd see that here.
6. **Approve deploy (30 s).** Click. The next message lists each deployed component with a direct link into Setup, Bob's test steps, and a quick test with a link to the demo deal.
7. **Prove it in Salesforce (2 min).** Open the deal, set Stage to Closed Won, save. Within seconds Slack posts the record the change created, with its link. Open it.
8. **Approve close (30 s).** The service rolls the change back, closes the case, emails the requester, archives the channel. The next case is already waiting.

## Lines that land

- "Three approvals, zero code typed, one real change in the org, reversed on close."
- "Bob designs and writes. The service validates and deploys. People approve in between. Bob never sees a credential."
- "Swap the skills, the prompts and the deploy target, and the same service serves a different system."

## If something goes wrong

- Validation fails three times: click Reject, the case resets, and the errors are in the channel. Good moment to show the governance, not a failure of the demo.
- A deploy takes longer than a minute: the audit log on the service shows each step; the Slack message appears when Salesforce answers.
