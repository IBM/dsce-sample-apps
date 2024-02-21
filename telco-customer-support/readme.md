## Set up and launch application

It is assumed that Python3+ is installed or download from https://www.python.org/downloads/.

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

4. Add .env file to your application folder and add env variable

   ##### Steps to create IBM Cloud API key

   - 4.1 In the IBM Cloud console, go to **Manage > Access (IAM) > API keys**
   - 4.2 Click **Create an IBM Cloud API key**
   - 4.3 Enter a name and description for your API key
   - 4.4 Click **Create**
   - 4.5 Then, click **Show** to display the API key. Or, click **Copy** to copy and save it for later, or click **Download**

   ```sh
   WATSONX_API_KEY=<your IBM Cloud API key>
   WML_INSTANCE_URL=https://us-south.ml.cloud.ibm.com
   ```

5. Add value of `project_id` key of your watsonx.ai instance to the `payload/rag-payload.json` & `payload/summary-payload.json` files.

   ##### Steps to create project_id

   - 5.1 In IBM Cloud, [Set up IBM Cloud Object Storage for use with IBM watsonx](https://dataplatform.cloud.ibm.com/docs/content/wsj/console/wdp_admin_cos.html?context=wx&audience=wdp)
   - 5.2 [Set up the Watson Studio and Watson Machine Learning services](https://dataplatform.cloud.ibm.com/docs/content/wsj/getting-started/set-up-ws.html?context=wx&audience=wdp)
   - 5.3 Create a Project from IBM watsonx console - https://dataplatform.cloud.ibm.com/projects/?context=wx
   - 5.4 Open the Project > Click on **Manage** tab > Click on **Access Control** from the **Manage** tab > Click [Add collaborators](https://dataplatform.cloud.ibm.com/docs/content/wsj/getting-started/collaborate.html?context=wx&audience=wdp#add-collaborators) > **Add Users** > Choose **role** as **Admin** > Click **Add**
   - 5.5 Click on **Manage** tab > Copy the **Project ID** from **General**

6. Source document is available in the `/data` folder. This `hybrid-cloud-mesh-documentation.pdf` file is chunked & stored into vectorstore upon server startup. Refer `init()` method in `rag.py` for more details.

7. Run the application.

   ```sh
   python3 template.py
   ```

You can now access the application from your browser at the following URL.

```url
http://localhost:8050
```
