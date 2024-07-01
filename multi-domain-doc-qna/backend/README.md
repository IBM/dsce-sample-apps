# Watsonx Discovery & Watsonx.ai RAG Application

This README will guide you through the steps to install the project locally and deploy it on OpenShift or IBM Code Engine. Additionally, you will learn how to access the Swagger documentation once the project is deployed.

## How to Install Locally

To install this project locally, follow these steps:

1. **Clone the repository**

2. **Navigate to the project directory:**

   ```bash
   cd <your-project>
   ```

3. **Create the Enviroment, Activate it, and Install Requirements:**

   Python Virtual Environment

   ```bash
   python -m venv assetEnv
   source assetEnv/bin/activate
   python -m pip install -r requirements.txt
   ```

4. **Update your secrets:**

   Copy `env` to `.env` and fill in the variables with your url, passwords, and apikeys.

   _Note_: `COS_IBM_CLOUD_API_KEY` and `IBM_CLOUD_API_KEY` are not the same key.

5. **Start the project:**

   ```bash
   python app.py
   ```

6. **URL access:**

   `localhost:4050`

   To access Swagger: <http://localhost:4050/docs>

## How to Deploy on OpenShift

To deploy this project on OpenShift, follow these steps:

1. **Log in to your OpenShift cluster:**

   ```bash
   oc login --token=YOUR_TOKEN --server=YOUR_SERVER
   ```

2. **Create a new project (optional):**

   ```bash
   oc new-project <project-name>

   oc project <project-name>
   ```

3. **Buld the application:**

   ```bash
   oc new-build --strategy docker --binary --name=watsonx-discovery-rag

   oc start-build watsonx-discovey-rag  --from-dir=. --follow --wait
   ```

4. **Deploy the application:**

   ```bash
   oc new-app watsonx-discovery-rag --name=watsonx-discovery-rag
   ```

5. **Expose a Secure URL for this FastAPI app:**

   ```bash
   oc create route edge --service=watsonx-discovery-rag
   ```

   A quick sanity check with the url create from the route: `<url>/docs` will take you to the swagger ui.

## How to Deploy on Code Engine

To deploy this project on IBM Code Engine, do the following:

1. **Login IBM Cloud and navigate to Code Engine:**

   Follow this link to get to Code Engine: <https://cloud.ibm.com/codeengine/projects>

   Create a new project if you haven't done so.

2. **Select your project on IBM Code Engine:**

   Navigate to the applications tab on the left side and click Create.

   Provide a name for the App, build the image from source code and specify the URL to this repo's ssh-git url.

   Create a repo access with your private to pull from the internal github.ibm.com.

   Select Main branch

   Click Next and don't change anything in the Specify build details.

   Click Next.

   Create a new Namespace for your user if you haven't already done so, give the image a name, same for the tag. I choose `latest`.

   Next change the Ephemeral storage to 2.0

   Limit the instance scaling to 0 and 1

   Select your domain. I choose Public.

   Under the Environmenta variables, take the `env` and create the variables with the credentials.

   Finally click Create.

3. **Accessing the URL on Code Engine**

   Wait for the build to complete and access the URL by selecting Domain mappings in the tab for the application.

   A quick sanity check with `<url>/docs` will take you to the swagger ui.

## How to Access Swagger Once Deployed

After deploying your application, you can access the Swagger documentation to test your API endpoints. The URL to access Swagger will depend on where your application is deployed.

- **OpenShift:** The URL will be based on the route created for your application. You can find the route by running:

  ```bash
  oc get route
  ```

  Then, append `/docs` to your application's URL.

- **Code Engine:** You can find your application's URL in the IBM Cloud dashboard under Code Engine > Applications. Again, append `/docs` to access the Swagger documentation.

## Using the API

After deploying the application, you can now access the API. To do so by postman:

1. Open a new tab and from the request type drowndown, select POST. In the url, paste your url (in this example, it's localhost): `http://127.0.0.1:4050/queryLLM`

2. Under Headers, add the following key/value: `RAG-APP-API-Key`/`<RAG_APP_API_KEY_FROM_.ENV>`

3. Under Body, select `raw` and paste the following json:

    ```json
    {
    "question": "What is 2+2?",
    "es_index_name": "<your_wxd_index_name>"
    }
    ```

4. Hit the blue `SEND` button and wait for your result.

5. Check `./docs` for additional parameters that can be passed in the body for more customization.
