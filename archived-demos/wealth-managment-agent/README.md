# Set up and launch application

## Pre-requisites

1. A watsonx.ai instance on IBM Cloud ([get a watsonx trial account](https://dataplatform.cloud.ibm.com/registration/stepone?context=wx)).

## Steps to Run the Backend Application Locally

1. Navigate to the `backend` directory from the root directory and create a `.env` file. You can refer the `example.env` file for your reference.

    ```bash
    IBM_CLOUD_API_KEY=
    WX_PROJECT_ID=
    WX_ENDPOINT=https://us-south.ml.cloud.ibm.com
    FASTAPI_KEY=wm
    USE_TOOL_CACHE=true # set to false to use the live tool results
    TAVILY_API_KEY=
    ```

##### Steps to create IBM Cloud API key

- 1.1 In the [IBM Cloud console](https://cloud.ibm.com/), go to **Manage > Access (IAM) > API keys**
- 1.2 Click **Create an IBM Cloud API key**
- 1.3 Enter a name and description for your API key
- 1.4 Click **Create**
- 1.5 Then, click **Show** to display the API key. Or, click **Copy** to copy and save it for later, or click **Download**

##### Steps to create project_id (skip 2.1 to 2.3 for watsonx trial account)

- 2.1 In IBM Cloud, [Set up IBM Cloud Object Storage for use with IBM watsonx](https://dataplatform.cloud.ibm.co5.2/docs/content/wsj/console/wdp_admin_cos.html?context=wx&audience=wdp)
- 2.2 [Set up the Watson Studio and Watson Machine Learning services](https://dataplatform.cloud.ibm.com/docs/co5.2tent/wsj/getting-started/set-up-ws.html?context=wx&audience=wdp)
- 2.3 Create a Project from IBM watsonx console - https://dataplatform.cloud.ibm.com/projects/?context=wx
- 2.4 (Optional step: add more collaborators) Open the Project > Click on **Manage** tab > Click on **Access Control** from the **Manage** tab > Click [Add collaborators](https://dataplatform.cloud.ibm.com/docs/content/ws5.2/getting-started/collaborate.html?context=wx&audience=wdp#add-collaborators) > **Add Users** > Choose **Console** as **Admin** > Click **Add**
- 5.2.5 Click on **Manage** tab > Copy the **Project ID** from **General**

##### Steps to create Tavily API key

- [Tavily documentation](https://app.tavily.com/home)

2. Source these environment variables in your environment by running the following command in terminal:

    ```bash
    export $(grep -v '^#' .env | xargs)
    ```

3. Install the npm dependencies by running the following command:

    ```bash
    pip install -r requirements.txt
    ```

4. Finally run the backend application with the following command:

    ```bash
    uvicorn main:app --reload
    ```

5. The app will start running on localhost port 8000.

> Note: Keep this terminal open for the frontend to work with backend.

## Steps to Run the Frontend Application Locally

1. In another terminal, navigate to `frontend` directory from the root directory and create another `.env` file. You can refer to the `example.env` file for your reference.
    
    ```bash
    VITE_BACKEND_URL=http://127.0.0.1:8000 # your backend URL
    VITE_API_KEY=wm # api key to access the backend URL. (FASTAPI_KEY)
    VITE_CHATBOT_NAME="Wealth Manager Agent"
    VITE_WELCOME_MESSAGE="Hi, I am a wealth manager agent. How can I assist you today?"
    VITE_ENABLE_CHAT=false # set to false to disable chat
    ```

2. Source these environment variables in your environment by running the following command in terminal:

    ```bash
    export $(grep -v '^#' .env | xargs)
    ```

3. Install the npm dependencies by running the following command:

    ```bash
    npm install
    ```

4. Finally run the frontend application with the following command:

    ```bash
    npm start
    ```

5. The app will start running on localhost port 3000.

6. Open the browser and navigate to `http://localhost:3000` to access the application.
