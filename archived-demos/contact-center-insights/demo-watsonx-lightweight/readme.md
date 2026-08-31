## Pre-requisites

1. Installed watsonx.ai [Lightweight engine](https://www.ibm.com/docs/en/cloud-paks/cp-data/5.0.x?topic=install-choosing-installation-mode#watsonxai-install-modes__title__2) on openshift cluster.
2. Installed following LLM models on the Lightweight engine:
   - ibm/granite-3-8b-instruct
   - mistralai/mixtral-8x7b-instruct-v01
   - google/flan-ul2

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

4. Add `.env` file to your application folder and add env variable

   ```sh
   SERVER_URL = <your CPD server URL>
   CPD_USERNAME=<your CPD username>
   CPD_PASSWORD=<yout CPD password>
   ```

5. Run the application.

   ```sh
   python3 template.py
   ```

You can now access the application from your browser at the following URL.

```url
http://localhost:8050
```
