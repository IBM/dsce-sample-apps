# Frontend application - UI

This is a frontend application which showcases the framework apis in action.
Example use case: Assume a developer looking for a prompt based on a particular search criteria in mind. The app will take him through step by step search process and once a prompt is found it will allow them to see the examples used & also make inference call.

## Steps to run locally

It is assumed that Python3+ is installed or download from <https://www.python.org/downloads/>.
Framework server should be up and running.

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

   ```sh
   FRAMEWORK_SERVER_URL = <URL-of-running-framework-server>
   APIAUTHCODE = <APIAUTHCODE-from-framework-server>
   ```

   > Note: If you do not provide APIAUTHCODE at the ENV level, then app will still start & app will ask user to enter the APIAUTHCODE (stored at browser level) before proceeding.

5. Run the application.

   ```sh
   streamlit run app.py
   ```

You can now access the application from your browser at the following URL.

```url
http://localhost:8501
```
