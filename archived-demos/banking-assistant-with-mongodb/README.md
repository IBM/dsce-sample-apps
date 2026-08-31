## Prerequisites

1. A watsonx.ai(watsonx.ai Studio, watsonx.ai Runtime, Cloud Object Storage) resources on [IBM Cloud](https://cloud.ibm.com/watsonx/overview).
2. Python3.11+ is installed or download from https://www.python.org/downloads/release/python-3111/.
3. A MongoDB Atlas database instance from https://www.mongodb.com/atlas


## Set up MongoDB Atlas

- **MongoDB Atlas: Cluster with Transaction and Customer Data Collections**,
MongoDB Atlas will be the primary database for storing and querying transaction and customer data.

1. Create a MongoDB Atlas Account

   *    Visit [MongoDB Atlas](https://www.mongodb.com/atlas) and click “Start Free”.
   *    Sign up using your email, or log in with Google, GitHub, or Microsoft.

2. Set Up a Cluster

   * Click “Build a Cluster” after logging in.
   * Choose a free tier cluster or upgrade for more features.
   * Select your cloud provider (AWS, Google Cloud, or Azure) and region.
   * Click “Create Cluster” to deploy (this may take a few minutes).

3. Configure Your Cluster

   * Go to “Database Access” and create a user with a username, password, and role (e.g., “Read and Write to Any Database”).
   * In “Network Access”, add your IP address or allow all IPs (0.0.0.0/0) for unrestricted development access.

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

   ##### Steps to create IBM Cloud API key

   - 5.1.1 In the [IBM Cloud console](https://cloud.ibm.com/), go to **Manage > Access (IAM) > API keys**
   - 5.1.2 Click **Create an IBM Cloud API key**
   - 5.1.3 Enter a name and description for your API key
   - 5.1.4 Click **Create**
   - 5.1.5 Then, click **Show** to display the API key. Or, click **Copy** to copy and save it for later, or click **Download**

   ##### Steps to create project_id (skip 5.2.1 to 5.2.3 for watsonx trial account)

   - 5.2.1 In IBM Cloud, [Set up IBM Cloud Object Storage for use with IBM watsonx](https://dataplatform.cloud.ibm.com/docs/content/wsj/console/wdp_admin_cos.html?context=wx&audience=wdp)
   - 5.2.2 [Set up the Watson Studio and Watson Machine Learning services](https://dataplatform.cloud.ibm.com/docs/content/wsj/getting-started/set-up-ws.html?context=wx&audience=wdp)
   - 5.2.3 Create a Project from IBM watsonx console - <https://dataplatform.cloud.ibm.com/projects/?context=wx>
   - 5.2.4 (Optional step: add more collaborators) Open the Project > Click on **Manage** tab > Click on **Access Control** from the **Manage** tab > Click [Add collaborators](https://dataplatform.cloud.ibm.com/docs/content/wsj/getting-started/collaborate.html?context=wx&audience=wdp#add-collaborators) > **Add Users** > Choose **role** as **admin** > Click **Add**
   - 5.2.5 Click on **Manage** tab > Copy the **Project ID** from **General**

   ```sh
   WML_SERVER_URL = https://us-south.ml.cloud.ibm.com
   WATSONX_API_KEY=<your IBM Cloud API key>
   WATSONX_PROJECT_ID=<your watsonx.ai project_id>
   MONGO_CONNECTION_URL=<your mongdb atlas connections string>
   ```

6. Run the preprocessing script to prepare data:
   ```sh
   python3 preprocessing.py
   ```
7. Run the application.

   ```sh
   python3 processing.py
   ```

You can now access the application from your browser at the following URL.

```url
http://localhost:5000/login
```
