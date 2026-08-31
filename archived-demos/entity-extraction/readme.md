# Set up and launch application

Requires python3 development tools to already be installed.

1. Go to the root directory and prepare your python environment.

    ```sh
    python3 -m venv client-env
    ```

1. Activate the virtual environment:

    * MacOS, Linux, and WSL using bash/zsh

    ```sh
    source client-env/bin/activate
    ```

    * Windows with CMD shell

    ```cmd
    C:> client-env\Scripts\activate.bat
    ```

    * Windows with git bash

    ```sh
    source client-env/Scripts/activate
    ```

    * Windows with PowerShell

    ```cmd
    PS C:> client-env\Scripts\Activate.ps1
    ```

    > if there is an execution policy error, this can be changed with the following command

    ```cmd
    PS C:> Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
    ```

1. Install the required libraries.

    ```sh
    pip3 install -r requirements.txt
    ```

1. Run the application.

    ```sh
    python3 <python file>
    ```

You can now access the application from your browser at the following URL.

```url
http://localhost:8050
```
