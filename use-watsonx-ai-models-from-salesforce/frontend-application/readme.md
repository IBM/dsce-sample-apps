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

   - 5.1 In the [IBM Cloud console](https://cloud.ibm.com/), go to **Manage > Access (IAM) > API keys**
   - 5.2 Click **Create an IBM Cloud API key**
   - 5.3 Enter a name and description for your API key
   - 5.4 Click **Create**
   - 5.5 Then, click **Show** to display the API key. Or, click **Copy** to copy and save it for later, or click **Download**

   ##### Steps to create project_id and get the region (skip 5.2.1 to 5.2.3 for watsonx trial account)

   - 5.2.1 In IBM Cloud, [Set up IBM Cloud Object Storage for use with IBM watsonx](https://dataplatform.cloud.ibm.com/docs/content/wsj/console/wdp_admin_cos.html?context=wx&audience=wdp)
   - 5.2.2 [Set up the Watson Studio and Watson Machine Learning services](https://dataplatform.cloud.ibm.com/docs/content/wsj/getting-started/set-up-ws.html?context=wx&audience=wdp)
   - 5.2.3 Create a Project from IBM watsonx console - https://dataplatform.cloud.ibm.com/projects/?context=wx
   - 5.2.4 (Optional step: add more collaborators) Open the Project > Click on **Manage** tab > Click on **Access Control** from the **Manage** tab > Click [Add collaborators](https://dataplatform.cloud.ibm.com/docs/content/wsj/getting-started/collaborate.html?context=wx&audience=wdp#add-collaborators) > **Add Users** > Choose **role** as **Admin** > Click **Add**
   - 5.2.5 Click on **Manage** tab > Copy the **Project ID** from **General**
   - 5.2.6 On the top right hand side just before your profile, you will see the city name (eg. Dallas). Click on it. Then in the dropdown you will see the region name right side of the city name (eg. us-south).

   ```sh
   SERVER_URL = https://apic-gw-gateway-integration.apps.66ba4b07545446001ef6af7d.ocp.techzone.ibm.com/apic-org/sandbox
   API_KEY = <your IBM Cloud API key>
   MODEL_ID = ibm/granite-3-8b-instruct
   MODEL_ID_TEST = ibm/granite-3-8b-instruct
   WATSONX_REGION = <your watsonx.ai project_id>
   WATSONX_PROJECTID = <your watsonx.ai region>
   ```

6. Run the application.

   ```sh
   python3 template.py
   ```

You can now access the application from your browser at the following URL.

```url
http://localhost:8050
```
