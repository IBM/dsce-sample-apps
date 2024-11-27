# Scanned document Q&A application

## Pre-requisites

1. A watsonx.ai instance on IBM cloud ([get a watsonx trial account](https://dataplatform.cloud.ibm.com/registration/stepone?context=wx)).
2. Cloud Object Storage bucket with pre-loaded image files ([reference document](https://dataplatform.cloud.ibm.com/docs/content/wsj/analyze-data/fm-api-files.html?context=wx&audience=wdp#adding-files-by-using-the-ui))
3. Data Engine Connection asset in watsonx project ([reference document step 3 onwards](https://dataplatform.cloud.ibm.com/docs/content/wsj/analyze-data/fm-api-files.html?context=wx&audience=wdp#adding-files-by-using-the-ui))
4. It is assumed that Python3+ is installed or download from <https://www.python.org/downloads/>.
5. It is assumed that Node.js 18+ is installed.

## Set up and launch application

### Run the backend server

1. Go to the `rag_demo_server` directory and prepare your python environment.

   ```sh
   cd rag_demo_server
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

5. Add `.env` file to your application folder and add env variables

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
   SERVER_URL = https://us-south.ml.cloud.ibm.com
   WATSONX_PROJECT_ID = <your watsonx.ai project_id>
   WATSONX_API_KEY = <your IBM Cloud API key>

   # data connection asset details
   WX_CONNECTION_ASSET_ID = <your data connection asset_id>
   WX_TXT_EXT_BUCKET_NAME = <bucket name>
   # Application will retry 5 times for job status check every 5 seconds
   WX_TXT_EXT_RESULT_RETRY_COUNT = 5
   WX_TXT_EXT_RESULT_WAIT_IN_SEC = 5
   # local path to download extraction txt file
   WX_TXT_EXT_RESULT_FILEPATH=./app/static/extraction/wdu

   # Origins allowed by this server to avoid CORS. You have to provide your ui url here.
   ALLOWED_ORIGINS=http://localhost:3000,https://<my-frontend-app-url>
   ```

6. Run the backend server.

   ```sh
   python -m app.web_server
   ```

You can now access the application endpoints at the following URL.

```url
http://localhost:5001
```

### Run the frontend app

1. Go to the `chatbot-ui` directory.

   ```sh
   cd ../chatbot-ui
   ```

2. Add `.env` file and add env variables

   ```sh
   # Url of backend server
   NEXT_PUBLIC_API_URL=http://localhost:5001
   # application port
   NEXT_PUBLIC_CLIENT_PORT=3000
   NEXT_PUBLIC_IS_SUGGESTION_ENABLED=true
   ```

3. Install dependencies

   ```sh
   npm install
   ```

4. Run the backend server.

   ```sh
   npm run dev
   ```

You can now access the application endpoints at the following URL.

```url
http://localhost:3000
```
