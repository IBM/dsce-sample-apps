# Spec-Driven Retail Order Fulfillment
Use these `Specifications` to perform `Spec-Driven Development` and build a comprehensive retail website using [IBM Bob](https://bob.ibm.com/) and the [IBM Building Blocks](https://ibm-self-serve-assets.github.io/building-blocks-docs).  

## Start by [visiting the Orbital Suppliers website](https://orbital-suppliers-2bef1f4b4097001da9502000c44fc2b2-0000.us-south.containers.appdomain.cloud) to see what you'll build

**NOTE:** Use the **Autocomplete with random user** button on the Login popup to access full customer ordering functionality.

<a href="https://orbital-suppliers-2bef1f4b4097001da9502000c44fc2b2-0000.us-south.containers.appdomain.cloud"><img width="768" src="https://github.com/user-attachments/assets/42203ac6-afdb-40f6-a5ad-31e43338db7e" /></a>

## Get Started.  Provide the Specifications to Bob to recreate the website for youself
**A.** Update [.env_template](.env_template) with required variables then rename to `.env`.

**B.** Add the [Building Blocks Skills](https://ibm-self-serve-assets.github.io/building-blocks-docs/ibm-bob/skills/) to your global `~\.bob` folder.

**C.** Ask Bob to:
```
Follow the instructions in @specifications/0-team-manager-ibm-building-blocks
```
Bob will [spawn a team of subagents](https://bob.ibm.com/docs/ide/features/subagents) to convert these [Specifications](specifications) into the website (~30 mins).

<img width="1024" src="https://github.com/user-attachments/assets/2fed1c9e-345e-4666-93ab-2800da784e5b" />


- [Spec 0:](specifications/0-team-manager-ibm-building-blocks.md) Teach Bob 2.0 to spawn a subagent team
- [Spec 1:](specifications/1-generate-dataset.md) Expand the initial product and user dataset
- [Spec 2:](specifications/2-rag-opensearch.md) Embed product data in an OpenSearch vector DB
- [Spec 3:](specifications/3-backend-apis.md) Architect and build all backend API endpoints
- [Spec 4:](specifications/4-frontend-ui.md) Build frontend's Home, Product, Shopping Cart, Account, Orders and Checkout pages
- [Spec 5:](specifications/5-agentic-product-search.md) Deploy search agent to watsonx Orchestrate
- [Spec 6:](specifications/6-quality-assurance.md) QA final solution

### D.Deploy to Rancher for local development
- [Spec 7:](specifications/7-containerize-rancher.md) Containerize using Rancher for local development

### E. Or deploy to IBM Cloud
- [Spec 8:](specifications/8-terraform-openshift-cluster.md) Provision cluster and worker nodes into Red Hat OpenShift on IBM CLoud
- [Spec 9:](specifications/9-containerize-openshift.md) Containerize and deploy to IBM CLoud
- [Spec 10:](specifications/10-embed-openshift.md) Push product embeddings to OpenSearch (now running on RHOS)

If you experience bugs, send them to [@anthony.stevens](https://ibm.enterprise.slack.com/team/W4B3Y14Q1)

## Spec-Driven Development
What is `Spec-Driven Development` and `Specifications`?  Spec-Driven Development is the evolution from crafting complex and quirky prompts for 3-5 secs of LLM effort to straightforward technical instructions that guide frontier models how to autonomously design, build, test, and refine production-ready solutions over 30–60 mins

<img width="750" src="https://github.com/user-attachments/assets/2b1c2e98-c77d-4061-881c-88fd907637e4" />
