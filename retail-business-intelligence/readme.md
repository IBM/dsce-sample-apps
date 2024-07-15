# Retail business intelligence application

## Pre-requisites

1. watsonx.data instance and data loaded into it.

### Data federation on watsonx.data

Data federation is a technique used to integrate data from different sources without moving the data to a central repository. This allows users to query and analyze data across multiple databases as if it were a single dataset.

Here are steps to implement Data federation using watsonx.data

1. Provision free trial instance of watsonx.data at https://www.ibm.com/products/watsonx-data
2. Click on `Start your free Trial`
3. Create new Login with your email id
4. Verify your email account on IBM Cloud
5. Redirect to page https://cloud.ibm.com/resources
6. You will be prompted for `Finish setting up your account`

### Section 1 Setting up IBM Cloud account

1. Select `Account information` and click `Next`
2. Provide company information `Company name`, `Country or region`, `Address line 1`, `Address line 2 (optional)`, `City`, `State`, `Postal Index Number`, `Phone number` and click `Next`
3. Check / Un-check `My billing address is same as my company address` and `My name and billing address are exactly same as they appeare on my credit card statement` as applicable and click on `Next`.
4. Provide `Tax information` as applicable.
5. Provide `Credit card information` as applicable.
6. Click on `Upgrade Account`
7. Click on `Close`.

### Section 2 Provision watsonx.data instance

1. On IBM Cloud account home page search for `watsonx.data` in top bar becide `IBM Cloud`.
2. While typing search result can be seen which is populated automatically, Click on `watsonx.data` available as service under catalog. You will be redirected to watsonx.data instance provisioning page.
3. Select `Lite` plan and `Free` Pricing.
4. Scroll down and fill `Service name`, `Tags`, `Access management tags` as needed. `Tags`, `Access management tags` can be kept blank.
5. Go through the terms and conditions and check mark the box. Click on `Creat` tab.
6. If you face error while provisioning of Instance due to high demand. Try to select different location from the dropdown and click `Create`.


### Section 3 Provision IBM Object storage

1. Logon to https://cloud.ibm.com/
2. Search for `object storage` and click on `Cloud Object Storage` service.
3. Choose an infrastructure as relevant.
4. Select `Lite` plan.
5. Mention `Service Name`, `Tags` (optional) as needed.
6. Click on `Create`.
7. Home page of cloud storage appear.
8. Click on `Create Bucket` on top right corner then click on `Create a Custom Bucket`
9. Provide bucket name `wxddemo` and other relavant details and click `Create Bucket`. New bucket wxddemo would be created.
10. Create Service credentials -> `New credentials`
11. Provide name `wxddemo` -> Role `manager` -> Select Service ID `Auto Generated` -> Include HMAC credentials `On`
12. Service credentials would be created. `access_key_id` and `secret_access_key` would be used later in this document.
13. Click on Bucket `wxddemo`
14. Navigate to `Configuration` tab
15. Search for `Endpoints` -> select `Public` endpoint

### Section 4 Provision PostgreSQL Instance

##### Note: In IBM cloud, PostgreSQL is not available for free. You can provision PostgreSQL at your end & store the connection details for the future references. If you want to provision it in IBM cloud then paid service is available.

### Section 5 Navigate to watsonx.data instance

1. Navigate to resource page https://cloud.ibm.com/resources
2. Click on Hemberger menu top left
3. Navigate to `Resource List`
4. Expand `Databases`.
5. Click on watsonx.data instance name created in above steps.
6. Click on `Open web console`
7. Provide your IBM Cloud ID and password if asked.
8. Welcome page would be available. Click on `Finish and Go` tab on bottom right corner.
9. Message would be displayed `We're preparing your instance` it might take upto 15 minutes to complete.
10. Once instance is provisioned click on Hemberger icon on top left corner and review the list for all components available. (`infrastructure Manager, Data Manager`, `Query Workspace`, `Query History`, `Access Control`, `Billing and Usage`)

### Section 6 Setup CoS for data federation in watsonx.data

1. Navigate to `Infrastructure Manager` in watsonx.data UI. (Continuation of step 10 of `Navigate to watsonx.data instance` section)
2. Click on `Add Component` on top right corner.
3. Select `Add Storage`
4. Provide below information  
   Storage Type: IBM Cloud Object Storage
   Region : <as applicable> (Dallas by default)
   Endpoint: <public endpoint derived in Step 4>
   Bucket Name : wxddemo
   Display Name: wxddemo
   User name: <access_key_id generated in Step 4>
   Password: <secret_access_key generated in step 4>
5. Click on `Test Connection` which should show `Successful` status
6. Tick `Associate Catalog` and `Activate Now`
7. Catalog Type `Apache Iceberg`
8. Catalog Name `cos`
9. Click on `Activate Now and Register`
10. New catalog `cos` and storage `wxddemo` added to Infrastructure page.
11. Hover over catalog `cos` -> click on `manage associations` and connect to `presto` engine. Check the presto and click on `Save and restart engine`.
12. Navigate to `Data Manager` page.
13. Click on `Create` -> `Create schema`
14. Select Catalog `cos` and Name `retail`
15. Navigate to `SQL` page.
16. Execute attached queries in SQL page. <CoS_Queries.sql>

### Section 7 Setup PostgreSQL for data federation in watsonx.data

1. Navigate to `Infrastructure Manager` in watsonx.data UI. (Continuation of step 10 of `Navigate to watsonx.data instance` section)
2. Click on `Add Component` on top right corner.
3. Select `Add database`
4. Provide below information  
   Database type: `IBM PostgreSQL`
   Database Name:
   Display Name :
   Hostname:
   Port:
   Username:
   Password:
5. Toggle button to `Post is SSL enabled` and add/upload your certificate file.
6. Test Connection
7. Add Catalog Name `postgresql`.
8. Click on `Register`.
9. Hover over catalog `postgresql` -> click on `manage associations` and connect to `presto` engine.

## Set up and launch application

It is assumed that Python3+ is installed or download from <https://www.python.org/downloads/>.

1. Go to the root directory and prepare your python environment.

   ```sh
   python3 -m venv client-env
   ```

2. Activate the virtual environment:

   - MacOS, Linux, and WSL using bash/zsh

   ```sh
   source client-env/bin/activate
   ```

   - Windows with CMD shell

   ```cmd
   C:> client-env\Scripts\activate.bat
   ```

   - Windows with git bash

   ```sh
   source client-env/Scripts/activate
   ```

   - Windows with PowerShell

   ```cmd
   PS C:> client-env\Scripts\Activate.ps1
   ```

   > if there is an execution policy error, this can be changed with the following command

   ```cmd
   PS C:> Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```

3. Install the required libraries.

   ```sh
   pip3 install -r requirements.txt
   ```

4. [Get a watsonx trial account](https://dataplatform.cloud.ibm.com/registration/stepone?context=wx).

5. Add `.env` file to your application folder and add env variable

   ##### Steps to create IBM Cloud API key

   - 5.1.1 In the [IBM Cloud console](https://cloud.ibm.com/), go to **Manage > Access (IAM) > API keys**
   - 5.1.2 Click **Create an IBM Cloud API key**
   - 5.1.3 Enter a name and description for your API key
   - 5.1.4 Click **Create**
   - 5.1.5 Then, click **Show** to display the API key. Or, click **Copy** to copy and save it for later, or click **Download**

   ##### Steps to create project_id (skip 5.2.1 to 5.2.3 for watsonx trial account)

   - 5.2.1 In IBM Cloud, [Set up IBM Cloud Object Storage for use with IBM watsonx](https://dataplatform.cloud.ibm.com/docs/content/wsj/console/wdp_admin_cos.html?context=wx&audience=wdp)
   - 5.2.2 [Set up the Watson Studio and Watson Machine Learning services](https://dataplatform.cloud.ibm.com/docs/content/wsj/getting-started/set-up-ws.html?context=wx&audience=wdp)
   - 5.2.3 Create a Project from IBM watsonx console - https://dataplatform.cloud.ibm.com/projects/?context=wx
   - 5.2.4 (Optional step: add more collaborators) Open the Project > Click on **Manage** tab > Click on **Access Control** from the **Manage** tab > Click [Add collaborators](https://dataplatform.cloud.ibm.com/docs/content/wsj/getting-started/collaborate.html?context=wx&audience=wdp#add-collaborators) > **Add Users** > Choose **role** as **Admin** > Click **Add**
   - 5.2.5 Click on **Manage** tab > Copy the **Project ID** from **General**

   #### Presto host and engine id
   - Navigate to `Infrastructure Manager` in watsonx.data UI.
   - Click on Presto engine.
   - Get the `Host` and `Presto Engine` details.

   ```sh
   SERVER_URL = https://us-south.ml.cloud.ibm.com/ml/v1/text/generation?version=2023-05-29
   WATSONX_API_KEY=<your IBM Cloud API key>
   WATSONX_PROJECT_ID=<your watsonx.ai project_id>
   PRESTO_SERVER = https://<your presto host>/v1/statement?engine_id=<your presto engine id>
   PRESTO_USER = ibmlhapikey_<your IBM id>
   PRESTO_AUTH = <your IBM cloud API key>
   PRESTO_CATALOG = <Optional: you can keep it empty>
   PRESTO_SCHEMA = <Optional: you can keep it empty>
   ```

6. Run the application.

   ```sh
   python3 template.py
   ```

You can now access the application from your browser at the following URL.

```url
http://localhost:8050
```
