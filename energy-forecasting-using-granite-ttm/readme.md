# Energy forecasting using Granite TTM

## Prerequisites

1. Docker should be installed
2. It is assumed that Python3+ is installed or download from <https://www.python.org/downloads/>.

## Set up and launch TTM model inferencing API

1. Follow the readme provided https://github.com/ibm-granite/granite-tsfm/tree/main/services/inference for setting up the service. You will need end point of this service to use it in the backend server. If deployed locally then end point would be `http://localhost:5001`.

## Set up and launch backend server

1. Go to the backend directory and prepare your python environment.

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
4. Add `.env` file to your application folder and add env variable.

   ```
   DEFAULT_URL=<application url where the granite-tsfm service is running>
   ```


5. Download Energy dataset from below url and store it in the `data` folder with the name `energy_dataset.csv`.
   
   ```sh
   URL = https://www.kaggle.com/datasets/nicholasjhana/energy-consumption-generation-prices-and-weather
   ```

6. Run the application.

   ```sh
   python3 app.py
   ```

Now backend server is up and accessible at the following URL.

```url
http://localhost:8000
```

## Set up and launch frontend client app

1. Go to the frontend directory and install required dependencies.

   ```sh
   npm install
   ```

2. Add `.env` file to your application folder and add env variable.
   ```
   REACT_APP_BACKEND_URL=http://localhost:8000  #backend server url
   ```

3. Copy downloaded `energy_dataset.csv` file and paste it in the `public` folder with the name `Energy dataset.csv`.

4. Run the application.

   ```
   npm run start
   ```

You can now access the application from your browser at the following URL.

```url
http://localhost:3000
```