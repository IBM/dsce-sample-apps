# Ask my data application

## Pre-requisites

1. A watsonx Assistant instance on IBM cloud.

   **Steps to create watsonx Assistant**

   - 1.1 In the IBM cloud console, go to **Catalog > watsonx Assistant**
   - 1.2 Fill up the necessary details and click **Create** to create an instance.
   - 1.3 Once instance is created, go to the insatance & click **Launch watsonx Assistant**
   - 1.4 Follow steps **Create New > provide Assistant name > Create assistant**
   - 1.5 In this repo, we have provided `Ask-WA-3de5a-V13.zip` file which will be used in next step.
   - 1.6 From left hand side panel, go to **Assistant settings > Download/Upload files > Upload > upload the Ask-WA-3de5a-V13.zip > Upload and replace**
   - 1.7 Once upload is complete, the watsonx Assistant is ready & you can find two actions `upload-file & ask-question` under left hand side panel **Actions > Created by you**
   - 1.8 Turn off default Home screen. Go to left hand side panel **Environments > Draft > Web chat > Home screen** and turn off the toggle button. Click Save and exit button.
   - 1.9 Note down the assistant keys `integrationID`, `region` & `serviceInstanceID`, which will be used in setting the Environment file in next section. Go to left hand side panel **Environments > Draft > Web chat > Embed**

2. A watsonx.ai instance on IBM cloud ([get a watsonx trial account](https://dataplatform.cloud.ibm.com/registration/stepone?context=wx)).
3. A MySQL server database service.
4. It is assumed that Python3+ is installed or download from <https://www.python.org/downloads/>.

## Set up and launch application

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
   SERVER_URL = https://us-south.ml.cloud.ibm.com/ml/v1/text/generation?version=2023-05-29
   WATSONX_PROJECT_ID = <your watsonx.ai project_id>
   WATSONX_API_KEY = <your IBM Cloud API key>
   WML_SERVER_URL = https://us-south.ml.cloud.ibm.com

   # True/False. To enable/disable user to allow any file to be uploaded.
   FILE_LOCK_ENABLED = True

   # watsonx Assitant configs
   WAINTEGRATIONID = <your watsonx Assitant integration id>
   WAREGION = <your watsonx Assitant region>
   WASERVICEINSTANCEID = <your watsonx Assitant service instance id>

   FOUNDATION_MODELS_URL = https://us-south.ml.cloud.ibm.com/ml/v1/foundation_model_specs?version=2024-04-01
   APIAUTHCODE=<generate a new uuid for api call authorization>

   # MySQL database connection details
   DB_HOST = <MySQL server hostname>
   DB_PORT = <port number>
   DB_NAME = <database name>
   DB_USER = <username>
   DB_PASS = <base64 encoded password>
   ```

   > Reference Online uuid generator tool : <https://www.uuidgenerator.net>

6. Source document is available in the `/static/default-files` folder. These files are hashed via the function `hash_file()` inorder to restrict user to upload just these specific files. Change this logic as per your requirement in `mt_rag.py`.

7. `/prompts` folder holds default prompts for all ai tasks. One can modify these default prompts.

8. Run the application.

   ```sh
   python3 mt_rag.py
   ```

You can now access the application from your browser at the following URL.

```url
http://localhost:8050
```
