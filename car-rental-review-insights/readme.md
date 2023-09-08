# Directory structure

## data-assets

This directory contains some sample input data that you can use in the input box of the application.

## prompts

This directory contains different prompts that you can use in the application or in the watsonx Prompt Lab UI. For the sample application, You can edit payloads files inside the code-assets/payload to make changes.

## code-assets

This directory contains the application code and required files.

### Set up and launch application

It is assumed that Python3+ is installed or download from https://www.python.org/downloads/.

1. Go to the code-assets directory and prepare your python environment.

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

4. Add .env file to your application folder and add below env variable

   ```sh
   WATSONX_API_KEY=<your IBM Cloud API key>
   ```

5. Run the application.

   ```sh
   python3 <python file>
   ```

You can now access the application from your browser at the following URL.

```url
http://localhost:8050
```
