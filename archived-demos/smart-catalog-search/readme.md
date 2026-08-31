## Reverse Image Search Setting Up and Running Jupyter Notebook

1. Navigate to the `milvus-image-insert` directory, which contains a Jupyter notebook for inserting image data into Milvus.
   ```sh
   cd milvus-image-insert
   ```
3. **Install Jupyter Notebook**  
   Ensure Python3+ and pip are installed, then run:  
   ```sh
   pip install notebook
   ```
4. **Start Jupyter Notebook**  
   Navigate to your project directory and launch the notebook server:  
   ```sh
   jupyter notebook
   ```
5. **Access the Notebook**  
   Open the provided URL in your browser (usually `http://localhost:8888/`).
6. **Run Notebook Cells**  
   Select a cell and click the **Run** button or press `Shift + Enter`.
7. Update the following environment variables in your notebook configuration:
   ```sh
   MILVUS_HOST = <milvus-service-host-name>
   MILVUS_PORT = <milvus-service-port>
   MILVUS_SERVER_NAME = localhost
   MILVUS_USER = <milvus-connection-username>
   MILVUS_PASSWORD = <milvus-connection-password>
   ```
8. Model is trained with the images available under "train" folder.
9. Run all the remaining steps in the Jupyter notebook to create a Milvus collection for storing the data.
10. In the next application setup process, when build_image_insert.ipynb is run, it takes Search image from the test folder and performs similarity search on images available in from frontend. 


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

4. [Get a watsonx.data trial account](https://cloud.ibm.com/registration?target=/lakehouse&uucid=0b526df2f9c41d5f&utm_content=WXDWW).

   4.1. Create a Milvus service.
   4.2. Ingest the images in your Milvus service.

5. Add `.env` file to your application folder and add env variable

   ```sh
   COS_BUCKET_URL = <cos-bucket-url-of-image-store>
   MILVUS_HOST = <milvus-service-host-name>
   MILVUS_PORT = <milvus-service-port>
   MILVUS_SERVER_NAME = localhost
   MILVUS_USER = <milvus-connection-username>
   MILVUS_PASSWORD = <milvus-connection-password>
   ```

6. Run the application.

   ```sh
   python3 main.py
   ```

You can now access the application from your browser at the following URL.

```url
http://localhost:8050
```
