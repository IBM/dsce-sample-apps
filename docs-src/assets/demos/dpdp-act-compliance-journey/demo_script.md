# DPDP Act Compliance Journey — Demo Script

## Setup

1. **Open the live demo URL.** The app opens on Stage 1 (Consent), with a progress indicator in the header and a stage list in the left panel.
2. **Optionally enable "Guided Mode"** to walk the customer through the narrative automatically.

---

## Opening — Set the Context

**Seller:** *"Before we jump into the demo, let me quickly set the context. With India's Digital Personal Data Protection requirements, organizations need to think beyond just protecting data. They need to understand what personal data they have, why they are collecting it, how they are using and protecting it, who has access to it, and what happens when something goes wrong. So rather than looking at DPDP as a standalone compliance exercise, this demo shows how IBM can help address the end-to-end personal data lifecycle — from consent and discovery through protection, encryption, threat detection, and governance. Let's walk through that journey from the perspective of different personas in an organization."*

---

## Stage 1 — Collect: Consent (IBM Verify)

1. **Introduce the Data Principal persona.** Show them granting consent for specific purposes (e.g. identity verification, service enrollment) while leaving optional purposes (e.g. marketing) unchecked.
2. **Submit the consent form** and point out the resulting consent status.
3. **Revoke a consent** to show that withdrawal is immediately reflected — this illustrates the DPDP consent requirement in action.

**Seller takeaway:** *"From a business perspective, this gives organizations a more structured way to manage consent and establish a foundation for DPDP compliance."*

---

## Stage 2 — Discover: Know Your Data (IBM Guardium Discover and Classify)

1. **Switch to the Security Admin / DPO persona.**
2. **Run the discovery scan** and show it identifying sensitive data across the organization's databases.
3. **Submit a sample Data Subject Access Request (DSAR)** and show the resulting report — this illustrates how discovery supports DSAR response.

**Seller takeaway:** *"Know your data before you can govern your data — discovery becomes a critical foundation for responding to data rights requests and protecting personal information."*

---

## Stage 3 — Protect: Control Access (IBM Guardium Data Protection)

1. **Switch to the Data Analyst persona** and query customer data.
2. **Toggle masking on/off** to show sensitive fields (e.g. national ID numbers) being dynamically masked based on role.
3. **Switch between roles** (Analyst / Admin / DPO) to show how access policy changes what is visible.

**Seller takeaway:** *"This allows organizations to apply more granular controls around sensitive information while still enabling employees to do their jobs."*

---

## Stage 4 — Use: Encrypt and Manage Keys (IBM Vault)

1. **As the Security Admin, encrypt a piece of sample data** and decrypt it again to show authorized access.
2. **Walk through the key-rotation view** and the audit log to show ongoing key management.

**Seller takeaway:** *"This provides another layer of protection for sensitive information and supports stronger security controls around critical data."*

---

## Stage 5 — Detect: Respond to a Data Breach (IBM QRadar SIEM)

1. **Trigger the simulated breach scenario** — an unusual/unauthorized data export.
2. **Walk through the automated response flow**: session termination, access revocation, endpoint isolation, and DPO notification.
3. **Show the breach-notification workflow.**

**Seller takeaway:** *"The objective is to reduce the time between detection, containment and notification when a potential data breach occurs."*

---

## Stage 6 — Govern: Demonstrate Compliance (IBM OpenPages)

1. **Switch to the DPO persona** and open the compliance dashboard.
2. **Walk through the control areas** being tracked: consent, data protection, encryption, breach response, and data rights requests.
3. **Generate and show a sample compliance report.**

---

## Close — Connect the IBM Story

**Seller:** *"So, what we have demonstrated today is not six disconnected products. We've walked through one connected personal-data journey: Collect → Discover → Protect → Encrypt → Detect → Govern. At each stage, IBM provides capabilities that can help address a different part of the data protection and compliance lifecycle. The bigger business value is that organizations don't have to look at DPDP as just a compliance checkbox. They can build a more structured approach to understanding their personal data, protecting it, controlling access, responding to incidents and demonstrating their compliance posture."*
