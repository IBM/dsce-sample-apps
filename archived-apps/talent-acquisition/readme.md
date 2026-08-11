# Talent acquisition application

## Pre-requisites

1. A watsonx Assistant instance on IBM cloud.

   **Steps to create watsonx Assistant**

   - 1.1 In the IBM cloud console, go to **Catalog > watsonx Assistant**
   - 1.2 Fill up the necessary details and click **Create** to create an instance.
   - 1.3 Once instance is created, go to the insatance & click **Launch watsonx Assistant**
   - 1.4 Follow steps **Create New > provide Assistant name > Create assistant**
   - 1.5 In this repo, we have provided `hr-talent-WA.zip` file which will be used in next step.
   - 1.6 From left hand side panel, go to **Assistant settings > Download/Upload files > Upload > upload the hr-telant-WA.zip > Upload and replace**
   - 1.7 Once upload is complete, the watsonx Assistant is ready & you can find four default actions under left hand side panel **Actions > Set by assistant > Greet customer & No action matches**
   - 1.8 Turn off default Home screen. Go to left hand side panel **Environments > Draft > Web chat > Home screen** and turn off the toggle button. Click Save and exit button.
   - 1.9 Note down the assistant keys `integrationID`, `region` & `serviceInstanceID`, which will be used in setting the Environment file in next section. Go to left hand side panel **Environments > Draft > Web chat > Embed**

2. A watsonx.ai instance on IBM cloud.
3. A MySQL server database service.
4. It is assumed that Python3+ is installed or download from <https://www.python.org/downloads/>.

## Set up and launch application

1. Create MySQL table and load data into it using `sql/db_scripts.sql` file.

2. Go to the root directory and prepare your python environment.

   ```sh
   python3 -m venv client-env
   ```

3. Activate the virtual environment:

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

4. Install the required libraries.

   ```sh
   pip3 install -r requirements.txt
   ```

5. [Get a watsonx trial account](https://dataplatform.cloud.ibm.com/registration/stepone?context=wx).

6. Add `.env` file to your application folder and add env variable

   ##### Steps to create IBM Cloud API key

   - 6.1.1 In the [IBM Cloud console](https://cloud.ibm.com/), go to **Manage > Access (IAM) > API keys**
   - 6.1.2 Click **Create an IBM Cloud API key**
   - 6.1.3 Enter a name and description for your API key
   - 6.1.4 Click **Create**
   - 6.1.5 Then, click **Show** to display the API key. Or, click **Copy** to copy and save it for later, or click **Download**

   ##### Steps to create project_id\*\* (skip 6.2.1 to 6.2.3 for watsonx trial account)

   - 6.2.1 In IBM Cloud, [Set up IBM Cloud Object Storage for use with IBM watsonx](https://dataplatform.cloud.ibm.com/docs/content/wsj/console/wdp_admin_cos.html?context=wx&audience=wdp)
   - 6.2.2 [Set up the Watson Studio and Watson Machine Learning services](https://dataplatform.cloud.ibm.com/docs/content/wsj/getting-started/set-up-ws.html?context=wx&audience=wdp)
   - 6.2.3 Create a Project from IBM watsonx console - <https://dataplatform.cloud.ibm.com/projects/?context=wx>
   - 6.2.4 (Optional step: add more collaborators) Open the Project > Click on **Manage** tab > Click on **Access Control** from the **Manage** tab > Click [Add collaborators](https://dataplatform.cloud.ibm.com/docs/content/wsj/getting-started/collaborate.html?context=wx&audience=wdp#add-collaborators) > **Add Users** > Choose **role** as **Admin** > Click **Add**
   - 6.2.5 Click on **Manage** tab > Copy the **Project ID** from **General**

   ```sh
   SERVER_URL = https://us-south.ml.cloud.ibm.com/ml/v1/text/generation?version=2023-05-29
   WATSONX_API_KEY = <your IBM Cloud API key>
   WATSONX_PROJECT_ID=<your watsonx.ai project_id>

   # watsonx Assitant configs
   WAINTEGRATIONID = <watsonx assistant integration id>
   WAREGION = <region of watsonx assistant>
   WASERVICEINSTANCEID = <watsonx assistant instance id>

   # MySQL database connection details
   DB_HOST = <MySQL server hostname>
   DB_PORT = <port number>
   DB_NAME = <database name>
   DB_USER = <username>
   DB_PASS = <base64 encoded password>
   ```

7. Run the application.

   ```sh
   python3 template.py
   ```

You can now access the application from your browser at the following URL.

```url
http://localhost:8000
```
