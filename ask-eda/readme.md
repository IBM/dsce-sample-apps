## Prerequisites

### Download CLI for watsonx flows engine

1. Go to `https://wxflows.ibm.stepzen.com/`

2. Login with IBM ID or Github

   - After login you will see `Environment name`, `Domain`, `API key` and `Admin key`. Save these values as we will need it in upcoming steps.

3. Now on the left side pannel click on the 3rd option that it `Documentation`
4. Go to `Installation` and follow the steps to install the CLI

## Authenticate yourself from CLI

1. Go to your root directry of this project repository.
2. Run the below command to login to watsonx flows engine through CLI.

   ```sh
   wxflows login
   ```

   - CLI will ask you for the values of `Environment name`, `Domain`, `Admin key`. Provide those details as we have it from step 2 of above section.

3. Verify you are authenticated by running the below command.

   ```sh
   wxflows whoami
   ```

   - Your account details will be printed in the terminal.

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

4. Run the below command to initializes a new watsonx.ai flows engine project for you.

   ```sh
   wxflows init --interactive
   ```

   - In the interactive mode, provide the following information:

    ```sh
     - Do you wish to use retrieval-augmented generation (RAG)?: yes
     - Choose the document collection for context retrieval: create from local data
     - Path to the data: ./source
     - File types to include: all supported file types
     - Chunk size (in tokens): 500
     - Chunk overlap (in tokens): 50
     - Collection name: wxflows-eda
     - Endpoint name: wxflows-genai/wxflows-eda
     ```

5. Above `step 4` creates a couple of files:

   - wxflows.toml with your project configuration
   - .env.sample with the possible environment variables
   - watsonx.docs.tsv that includes your chunked dataset

6. [Get a watsonx trial account](https://dataplatform.cloud.ibm.com/registration/stepone?context=wx).

7. Add `.env` file to your application folder and add env variable

   ##### Steps to create IBM Cloud API key

   - 7.1.1 In the [IBM Cloud console](https://cloud.ibm.com/), go to **Manage > Access (IAM) > API keys**
   - 7.1.2 Click **Create an IBM Cloud API key**
   - 7.1.3 Enter a name and description for your API key
   - 7.1.4 Click **Create**
   - 7.1.5 Then, click **Show** to display the API key. Or, click **Copy** to copy and save it for later, or click **Download**

   ##### Steps to create project_id (skip 7.2.1 to 7.2.3 for watsonx trial account)

   - 7.2.1 In IBM Cloud, [Set up IBM Cloud Object Storage for use with IBM watsonx](https://dataplatform.cloud.ibm.com/docs/content/wsj/console/wdp_admin_cos.html?context=wx&audience=wdp)
   - 7.2.2 [Set up the Watson Studio and Watson Machine Learning services](https://dataplatform.cloud.ibm.com/docs/content/wsj/getting-started/set-up-ws.html?context=wx&audience=wdp)
   - 7.2.3 Create a Project from IBM watsonx console - <https://dataplatform.cloud.ibm.com/projects/?context=wx>
   - 7.2.4 (Optional step: add more collaborators) Open the Project > Click on **Manage** tab > Click on **Access Control** from the **Manage** tab > Click [Add collaborators](https://dataplatform.cloud.ibm.com/docs/content/wsj/getting-started/collaborate.html?context=wx&audience=wdp#add-collaborators) > **Add Users** > Choose **role** as **admin** > Click **Add**
   - 7.2.5 Click on **Manage** tab > Copy the **Project ID** from **General**

   ```sh
   STEPZEN_ENDPOINT = https://<Environment name>.<Domain>/wxflows-genai/wxflows-eda/graphql
   STEPZEN_APIKEY = <wxflows API key>
   STEPZEN_WATSONX_AI_TOKEN=<your IBM Cloud API key>
   STEPZEN_WATSONX_PROJECTID=<your watsonx.ai project_id>
   STEPZEN_WATSONX_HOST=us-south.ml.cloud.ibm.com

   FLOW_ENGINE_API_KEY=<wxflows API key>
   FLOW_ENGINE_URL=https://<Environment name>.<Domain>/wxflows-genai/wxflows-eda/graphql
   MODEL = ibm/granite-3-8b-instruct

   COLLECTION_NAME = wxflows-eda
   DEBUG_MODE=True
   ```

8. Upload your chunked data set to the vector database

   ```sh
   wxflows collection deploy
   ```

9. Modify flow by removing `//` (comment) from the `myRagWithGuardrails` inside the `flows` variable of the `wxflows.toml` file.

10. Deploy the flows

    ```sh
    wxflows flows deploy
    ```

11. Run the application.

```sh
python3 template.py
```

You can now access the application from your browser at the following URL.

```url
http://localhost:8050
```
