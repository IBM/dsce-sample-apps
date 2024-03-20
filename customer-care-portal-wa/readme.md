# Customer care portal application

## Pre-requisites

1. A watsonx Assistant instance on IBM cloud.

   **Steps to create watsonx Assistant**

   - 1.1 In the IBM cloud console, go to **Catalog > watsonx Assistant**
   - 1.2 Fill up the necessary details and click **Create** to create an instance.
   - 1.3 Once instance is created, go to the insatance & click **Launch watsonx Assistant**
   - 1.4 Follow steps **Create New > provide Assistant name > Create assistant**
   - 1.5 In this repo, we have provided `customer-care-prtl-WA.zip` file which will be used in next step.
   - 1.6 From left hand side panel, go to **Assistant settings > Download/Upload files > Upload > upload the customer-care-prtl-WA.zip > Upload and replace**
   - 1.7 Once upload is complete, the watsonx Assistant is ready & you can find actions & dialogs under left hand side panel **Actions > Created by you** and **Dialog > Dialog**
   - 1.8 Turn off default Home screen. Go to left hand side panel **Environments > Draft > Web chat > Home screen** and turn off the toggle button. Click Save and exit button.
   - 1.9 Note down the assistant keys `integrationID`, `region` & `serviceInstanceID`, which will be used in setting the Environment file in next section. Go to left hand side panel **Environments > Draft > Web chat > Embed**

2. A watsonx.ai instance on IBM cloud.

## Set up and launch application

1. [Get a watsonx trial account](https://dataplatform.cloud.ibm.com/registration/stepone?context=wx).

2. Add watson assistant's `integrationID`, `region` & `serviceInstanceID` in the `scripts/watson_assistant.js` file.

3. Add extension to watsonx Assistant

   **Steps to create extension in watsonx Assistant**

   - 3.1 In the watsonx Assistant window go to left hadn side and click `Integration`
   - 3.2 Click the `Build custom extension` button inside the `Extensions` part.
   - 3.3 Click the Next button at top right side.
   - 3.4 Provide name and description of extension and click Next.
   - 3.5 Upload `watsonx-openapi.json` file and click Next.
   - 3.6 Review details and click Finish.

4. Add authentication to extension.

   ##### Steps to create IBM Cloud API key

   - 4.1 In the [IBM Cloud console](https://cloud.ibm.com/), go to **Manage > Access (IAM) > API keys**
   - 4.2 Click **Create an IBM Cloud API key**
   - 4.3 Enter a name and description for your API key
   - 4.4 Click **Create**
   - 4.5 Then, click **Show** to display the API key. Or, click **Copy** to copy and save it for later, or click **Download**

   ##### Steps to add IBM Cloud API key to extension

   - Click add on extension > click on Add button on the popup. > Click Next.
   - Select OAuth2.0 from dropdown.
   - Provide API key in the Custom secret API input box.
   - Click Next > Finish.
     <br>

5. Add project id to LLM call

   ##### Steps to create project_id (skip 5.1 to 5.3 for watsonx trial account)

   - 5.1 In IBM Cloud, [Set up IBM Cloud Object Storage for use with IBM watsonx](https://dataplatform.cloud.ibm.com/docs/content/wsj/console/wdp_admin_cos.html?context=wx&audience=wdp)
   - 5.2 [Set up the Watson Studio and Watson Machine Learning services](https://dataplatform.cloud.ibm.com/docs/content/wsj/getting-started/set-up-ws.html?context=wx&audience=wdp)
   - 5.3 Create a Project from IBM watsonx console - https://dataplatform.cloud.ibm.com/projects/?context=wx
   - 5.4 (Optional step: add more collaborators) Open the Project > Click on **Manage** tab > Click on **Access Control** from the **Manage** tab > Click [Add collaborators](https://dataplatform.cloud.ibm.com/docs/content/wsj/getting-started/collaborate.html?context=wx&audience=wdp#add-collaborators) > **Add Users** > Choose **role** as **Admin** > Click **Add**
   - 5.5 Click on **Manage** tab > Copy the **Project ID** from **General**

   ##### Steps to add project id

   - From watsonx Assistant left hand side select **Actions > Create by you**
   - Go inside the first action > select step 1 of `Conversation steps` from left side > scroll down to end and click on `Edit extension` > add project id to `project_id` key. Follow this step for all the 3 actions.

6. To run the app, open `index.html` file directly in the browser.
