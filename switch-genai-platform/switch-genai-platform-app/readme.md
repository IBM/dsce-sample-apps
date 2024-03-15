# Set up and launch application

It is assumed that Python3+ is installed or download from <https://www.python.org/downloads/>.
Also, it is presumed that you already have a setup/running multi-vendor-genai-framework server instance.

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

4. Add `.env` file to your application folder and add env variable

   ##### Steps to create IBM Cloud API key

   - 4.1 In the [IBM Cloud console](https://cloud.ibm.com/), go to **Manage > Access (IAM) > API keys**
   - 4.2 Click **Create an IBM Cloud API key**
   - 4.3 Enter a name and description for your API key
   - 4.4 Click **Create**
   - 4.5 Then, click **Show** to display the API key. Or, click **Copy** to copy and save it for later, or click **Download**

   ```sh
   APIAUTHCODE=<your api auth code for calling your framework>
   ```

5. In `app-config.properties`, set the framework server url value in `SERVER_URL` key.

6. Run the application.

   ```sh
   python3 template.py
   ```

You can now access the application from your browser at the following URL.

```url
http://localhost:8050
```
