# Multi-domain documents Q&A application

## Pre-requisites

1. A watsonx Assistant instance on IBM cloud.

   **Steps to create watsonx Assistant**

   - 1.1 In the IBM cloud console, go to **Catalog > watsonx Assistant**
   - 1.2 Fill up the necessary details and click **Create** to create an instance.
   - 1.3 Once instance is created, go to the insatance & click **Launch watsonx Assistant**
   - 1.4 Follow steps **Create New > provide Assistant name > Create assistant**
   - 1.5 In this repo, we have provided `IBM-WA-cc99f-V9.zip` file which will be used in next step.
   - 1.6 From left hand side panel, go to **Assistant settings > Download/Upload files > Upload > upload the IBM-WA-cc99f-V9.zip > Upload and replace**
   - 1.7 Once upload is complete, the watsonx Assistant is ready & you can find all the actions under left hand side panel **Actions > Created by you**
   - 1.8 Note down the assistant keys `integrationID`, `region` & `serviceInstanceID`, which will be used in setting the Environment file in next section. Go to left hand side panel **Environments > Draft > Web chat > Embed**

2. A watsonx.ai instance on IBM cloud ([get a watsonx trial account](https://dataplatform.cloud.ibm.com/registration/stepone?context=wx)).

3. A watsonx Discovery database service on IBM cloud.

   - 3.1 This demo app has been setup using the 'Database for Elasticsearch' version 8.12
   - 3.2 Redeem USD 250 credit for new user from <https://www.ibm.com/products/databases-for-elasticsearch>. This credit may last for few days as Platinum edition of Database for Elasticsearch is very expensive so keep monitor the credit usage.
   - 3.3 Login to IBM cloud console, go to **Catalog > Databases for Elasticsearch**.
   - 3.4 Fill up the necessary details and click **Create** to create an instance.

     There are two database edition `Enterprise` and `Platinum`. Machine learning (ML Model ELSER) is only available in `Platinum` edition so choose the approciate edition. For more informaiton read the document - <https://cloud.ibm.com/docs/databases-for-elasticsearch?topic=databases-for-elasticsearch-es-ml-ai>.

   - 3.5 Once instance is created, go to the database & **Launch it**.
   - 3.6 Go to Service Credentials & click **New credential**, give name & click **Add**.
   - 3.7 Expand the newly created service credentail & find below information and save it somewhere for connecting the database:
     username, password, hostname, port.

4. It is assumed that Python3+ is installed or download from <https://www.python.org/downloads/>.

## Set up and launch application

### Run the backend server

1. Go to the `backend` directory and prepare your python environment.

   ```sh
   cd backend
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

   **Steps to create IBM Cloud API key**

   - 5.1.1 In the [IBM Cloud console](https://cloud.ibm.com/), go to **Manage > Access (IAM) > API keys**
   - 5.1.2 Click **Create an IBM Cloud API key**
   - 5.1.3 Enter a name and description for your API key
   - 5.1.4 Click **Create**
   - 5.1.5 Then, click **Show** to display the API key. Or, click **Copy** to copy and save it for later, or click **Download**

   **Steps to create project_id (skip 5.2.1 to 5.2.3 for watsonx trial account)**

   - 5.2.1 In IBM Cloud, [Set up IBM Cloud Object Storage for use with IBM watsonx](https://dataplatform.cloud.ibm.com/docs/content/wsj/console/wdp_admin_cos.html?context=wx&audience=wdp)
   - 5.2.2 [Set up the Watson Studio and Watson Machine Learning services](https://dataplatform.cloud.ibm.com/docs/content/wsj/getting-started/set-up-ws.html?context=wx&audience=wdp)
   - 5.2.3 Create a Project from IBM watsonx console - <https://dataplatform.cloud.ibm.com/projects/?context=wx>
   - 5.2.4 (Optional step: add more collaborators) Open the Project > Click on **Manage** tab > Click on **Access Control** from the **Manage** tab > Click [Add collaborators](https://dataplatform.cloud.ibm.com/docs/content/wsj/getting-started/collaborate.html?context=wx&audience=wdp#add-collaborators) > **Add Users** > Choose **role** as **Admin** > Click **Add**
   - 5.2.5 Click on **Manage** tab > Copy the **Project ID** from **General**

   ```sh
   # watsonx.ai api server url
   WX_URL = https://us-south.ml.cloud.ibm.com
   WX_PROJECT_ID = <your watsonx.ai project_id>
   IBM_CLOUD_API_KEY = <your IBM Cloud API key for watsonx.ai>

   # cloud object storage connection
   COS_IBM_CLOUD_API_KEY = <your API Key for COS bucket>
   COS_ENDPOINT_URL = <for example: https://s3.us-south.cloud-object-storage.appdomain.cloud>
   COS_INSTANCE_ID = <your COS instance id>

   # watsonx Discovery instance connection
   WXD_USERNAME = <your watsonx Discovery instance connection username>
   WXD_PASSWORD = <your watsonx Discovery instance connection password>
   WXD_URL = <your watsonx Discovery instance connection URL>

   # watson Discovery instance connection (Optional, keep empty)
   WD_API_KEY=""
   WD_URL=""

   RAG_APP_API_KEY=<generate a new uuid for api call authorization>
   ```

   > Reference Online uuid generator tool : <https://www.uuidgenerator.net>

6. Run this command to prepare required data.

   ```sh
   python3 prereqs.py
   ```

7. Run the backend server.

   ```sh
   python3 app.py
   ```

You can now access the application from your browser at the following URL.

```url
http://localhost:4050
```

To access the OpenAPI docs: <http://localhost:4050/docs>

Note: After successful setup in local, for deployment on OpenShift/ Code Engine, refer to the **README.md** available under `./backend` directory.

#### Ingest data in watsonx Discovery instance

1. Before you ingest the data, verify that you have already created the **Cloud Object Bucket** and uploaded all your documents in a bucket.
2. Run the following curl command to start the document ingestion process to your watsonx Discovery instance (this will take couple of minutes based on number/size of your documents, wait till ingestion is completed.):

   ```sh
   curl --request POST 'https://<localhost/port>/ingestDocs' \
    --header 'Content-Type: application/json' \
    --header 'RAG-APP-API-Key: <your rag app api key>' \
    --data-raw '{
      "bucket_name": "documents",
      "es_index_name": "docs-prod-rag-index",
      "es_pipeline_name": "docs-prod-rag-pipeline",
      "chunk_size": "512",
      "chunk_overlap": "256",
      "es_model_name": ".elser_model_2",
      "es_model_text_field": "text_field",
      "es_index_text_field": "body_content_field"
    }'
   ```

#### Connect watsonx Assistant with backend server

##### Create an extension

1. In the `../ext-watsonx-openapi.json` file, put the backend server url in **server > url** field and save the file.
2. Open up your watsonx Assistant service & select your chatbot.
3. From left hand side panel, go to **Integrations** > click **Build custom extension** > click **Next**.
4. Give name for this extension (for example: _RAG_WXD_DSC_).
5. Import the `ext-watsonx-openapi.json` file > click **Next**.
6. Review the details of extension > click **Finish**.
7. Find this extension in catalog > click **Add** > click **Next**.
8. Choose Authentication type as **API key auth**.
9. In API key field, copy and paste value of your environment variable `RAG_APP_API_KEY`.
10. Click **Next** > **Finish**. This completes our extension creation steps.

##### Connect actions with extension

1. From left hand side panel, go to **Actions** > click **ask a question - call extension**.
2. Click on **conversation step 1** > click **Edit extension**.
3. Choose extension (for example: _RAG_WXD_DSC_) > choose operation **Queryllm**
4. Parameters:
   1. Set **question** To **Session variables** > **question**
   2. Set **es_index_name** To **Enter text** > _Enter your index name from wx Discovery_
   3. Optioinal parameters, verify value of **es_model_name**, it should be matching with the model you have used while ingesting docs in watsonx Discovery.
   4. Click **Apply**.
5. Save the action.

### Run the frontend app

1. Go to the `frontend` directory.

   ```sh
   cd ../frontend
   ```

2. In `./scripts/javascript.js` file, put your watsonx Assistant's integration id & service instance id at the below provided code snippet.

   ```javascript
   // Find this code snippet and replace the values for integrationID & serviceInstanceID with actual ids.
   window.watsonAssistantChatOptions = {
      integrationID: "<your-watsonx-Assistant-integration-id>",
      region: "us-south",
      serviceInstanceID: "<your-watsonx-Assistant-service-instance-id>",
      showRestartButton: true,
      ...
   }
   ```

3. To launch the frontend app, open the `index.html` in any known web browser.
