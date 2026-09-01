
# Orbital Suppliers
You should start with the fact that AI Engineers are shifting from Vibe Coding to Spec-Driven Development to build applications.  Explain that this demo was built from zero code using only [these natural language specifications describing the app to-be-built](https://github.com/ibm-self-serve-assets/sdd-orbital-outfitters).  IBM Bob reads the specifications plus any required [Skills for IBM Building Blocks](https://ibm-self-serve-assets.github.io/building-blocks-docs/ibm-bob/skills/) to have the knowledge about best practices and up-to-date knowledge for using IBM products.

So this demo has two personae: 
1. Fictional space travelers which use the Orbital Outfitters retail website to purchase supplies
2. AI engineers that would have written the Specifications describing the website

The Orbital Suppliers retail website was chosen as a use case that is easy for anyone to understand.  Building this retail website starting from zero-code shows the power of Spec-Driven Development while also provided re-usable specifications around IBM's products that partners can use to develop their own solutions.

## Persona 1: Applcation Users / Space Travelers
First demo the website's functionality then shift to the specifications used to build it. 

Start from the home page and show that this is not a typical vibe coded website.  The website looks professionally designed with consistent colors and provides rich functionality:
- agentic search
- product pages
- shopping cart
- account screens
- historical orders

From the home page, click on a provided natural language search example to open the agentic search screen.  Explain that IBM Bob designed the AI agent handling the user's search and then deployed it to watsonx Orchestrate based solely on the **5-agent-product-search.md** specifications.  In addition, IBM Bob followed the **2-rag-opensearch.md** specification to vectorize product info then deploy into an OpenSearch vector database.

**All Specifciations are provided in the GitHub repo for this demo.**. So now would be a good time to show a specification to your partner to help clarify what specifications looks like.

After refining the search by asking additional questions, click on one of the products to view details about it.  All product content is pulled from a product database including descriptions, images and 5-10 reviews for over 100 products.  IBM Bob followed the other Specifications to determine how to access the database, build all the screens then containerize the app before deploy everything to Red Hat OpenShift in IBM Cloud.

Show other website functionality as needed.

## Persona 2: AI Engineers
Shift to showing your partner the folder containing all the Specifications for this demo.  They are ordered by the flow that IBM Bob would follow when bulding the website.

Explain that you understand enterprise websites are built by teams, not solo coders vibing a simple POC.  That's why specifications are highly detailed documents that centralize all knowledge plus artifacts from the various team members.  Specifications document all of this up-front to avoid needless rework and token costs of incrementally feeding knowledge to IBM Bob.

For example, the **4-frontend-ui.md** specification provides the on-brand color palette plus screen comps in **/specifications/frontend/design-mockups** which are professionally designed image for each screen of the website. Note the **6-backend-frontend.md** which Bob follows prior to containerizing the deploying to IBM Cloud.

### Deploy everything to Red Hat OpenShift in IBM Cloud
Specifications 7-11 provide the instructions for deploying to IBM Cloud and provide re-usable examples for how your partner can use IBM Bob to execute these same tasks.  At the top of each Spec, you will see reference to [Skills for IBM Building Blocks](https://ibm-self-serve-assets.github.io/building-blocks-docs/ibm-bob/skills/) that Bob uses to obtain up-to-date knowledge about IBM technologies.

Explain that partners should download these skills for use in their own solutions.  Offer a Spec-Driven Development workshop where the IBM Build Engineering team can walk your partner through best practices in applying Spec-Driven Development within their own team.


