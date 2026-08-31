# Set up and launch application

Requires python3 development tools to already be installed.

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

4. Run the code to build index from sample data in ./hotel_review. This may take sometime. You can edit the code to process lesser number of records.

   ```sh
   python3 build_index.py
   ```

5. Run the search application that uses the index files. For entity search term use <entity name>:<value> and for keyword term use <value>. Terms can be ',' separated. Records having more term matches are ranked higher.

   ```sh
   python3 search.py
   ```

6. You can now access the application from your browser at the following URL.

   ```url
   http://localhost:8050
   ```
