# Retail Agentic AI – Backend App Deployment Details  

⚙️ XYZ Retails plans to implement an AI-Driven Inventory Management Agents to support their team of branch managers/store managers reduce stock overtime, optimized restocking and faster forecasting. 
The following instructions show you how to set this up.

## Deployment Information  
- The backend service for the Retail application is implemented using **FastAPI** and should be deployed on **IBM Code Engine** and the build image should be created in **IBM Container Registry**. You can find the backend script for code engine [here](code-engine/app.py)

- The specific instance used for deployment is **"watsonx Orchestrate essentials plan"**.  
  
## API Documentation  
- The **OpenAPI specification ([orchestrate_specfiles](openapi.json))** provides API details that can be imported into **Watsonx Orchestrate Agent Builder as Tools** for creating and managing tools.  



# Product Integration Guide: Agent Lab & WXO

Click [here](/labxs/handson_lab.md) for setup and integration details for connecting **Agent Lab** and **watsonx orchestrate**. Using this guide you can create an APP that will be used to generate a bearer token for external-agent integration with WXO.

## Note: After you have deployed the application on code engine

- You need to replace the `url` in all the  `openapispecs`, and share the updated openapispecs with the LAB practitioners.

# App deployment Guide:

## Reserving the techzone instance

Reserve the techzone instance that includes watsonx.ai, watsonx orchestrate, IBM code engine and Container Registry. 
You can reserve it using [watsonx Orchestrate essentials plan](https://techzone.ibm.com/my/reservations/create/66b284f968c2be001e970f3a)

## Getting environment vairables for deployment

Before deployment on code engine you need to generate API Key

1.	Click on hamburger icon on top left and select “Access (IAM)”.

<img width="1000" alt="image" src="./labs/code-engine-deployment/image33.png">


2.	In next screen, select “API Keys” from menu.

<img width="1000" alt="image" src="./labs/code-engine-deployment/image34.png">

3.	Click on “Create”.

<img width="1000" alt="image" src="./labs/code-engine-deployment/image35.png">

4.	Give your API key a name, then click on “Create”.

<img width="1000" alt="image" src="./labs/code-engine-deployment/image36.png">


5.	Copy the API key that is shown after clicking on “create”. Paste it somewhere, it’ll be used in later steps. This is the value of watson_ai_api_key variable that you'll need later.

<img width="1000" alt="image" src="./labs/code-engine-deployment/image37.png">

## Code Engine Deployment
1. Navigate to IBM Cloud.

<img width="1000" alt="image" src="./labs/code-engine-deployment/image0.1.png">

2. Click on the hamburger menu in the top left and then select **Resource List**.

<img width="1000" alt="image" src="./labs/code-engine-deployment/image0.2.png">

3 This will show you a list of available resources in your instance. Select **Containers**, which will give you a list of products. Choose the **Code Engine** product.

<img width="1000" alt="image" src="./labs/code-engine-deployment/image0.3.png">

4. This is homepage of code engine.

<img width="1000" alt="image" src="./labs/code-engine-deployment/image1.1.png">

5. From menu, click on "Applications", then click on "Create".

<img width="1000" alt="image" src="./labs/code-engine-deployment/image2.2.png">

6. Give your application a name. Select "Build container image from source code" under Code section. Paste your repo url for example : "https://github.ibm.com/skol/agentic-ai-client-bootcamp-instructors.git" in "Code repo URL" field. Select the
Then click on "Specify build details"

<img width="1000" alt="image" src="./labs/code-engine-deployment/image1.png">


  6.1.  For later steps you'll be needing an SSH secret key and Registry secret.
      Follow the "Pre-requisites" section of this
      [Guide](./environemt_setup/Readme.md). If you already have an SSH secret and registry secret, you can skip.


7. In "SSH secret" field, you have to select your ssh secret to access Github Repo. In "Branch name" field, type "main" or your corresponding branch name.
In "Context directory" field, keep et empty if your Dockerfile is present in root folder else, mention the directory the file is in. 
Finally click on "Next".

<img width="1000" alt="image" src="./labs/code-engine-deployment/image2.png">

8. In next step, select Strategy "Dockerfile", keep Timeout "40m". In "Build resources", select "M(1 vCPU / 4 GB)" from dropdown. Then click on "Next"

<img width="1000" alt="image" src="./labs/code-engine-deployment/image3.png">

9. Select available registry server from dropdown in "Registry Server" field, In "Registry secret" field, select your registry secret. "Namespace" field will be automatically filled, otherwise you can select one from dropdown. 
Give your Repository (image) a name, in "Tag" section, type "latest". Finally click on "Done".

<img width="1000" alt="image" src="./labs/code-engine-deployment/image4.png">

10. Scroll down a bit. Increase "Min number of instances" by 1. 

<img width="1000" alt="image" src="./labs/code-engine-deployment/image7.png">

11. Select "Public" in Domain mappings.

<img width="1000" alt="image" src="./labs/code-engine-deployment/image8.png">

14. In 'Image start options', under "Listening port", change it to the port you need, in our case it is 8080

 <img width="1000" alt="image" src="./labs/code-engine-deployment/image11.png">

15. Click on "Create" in right.

  <img width="1000" alt="image" src="./labs/code-engine-deployment/image5.png">   

16. Wait for the status to change to "Ready". Once its ready, click on the application.

  <img width="1000" alt="image" src="./labs/code-engine-deployment/image6.png">

17. Click on "Test application".

  <img width="1000" alt="image" src="./labs/code-engine-deployment/image6.1.png">

18.  Click on "Application URL". You'll be directed to a website. Copy the url of that website.

  <img width="1000" alt="image" src="./labs/code-engine-deployment/image6.2.png">   

 
19. Put the URL (that you got in step 18) in openapi.json file as shown in image below. You need to provide this updated openspecs file to client.

  <img width="1000" alt="image" src="./labs/code-engine-deployment/image6.3.png">
 
20. Before starting the bootcamp with clients verify that you have a credential file that has:

a. Watsonx URL (You got it in [Getting environment vairables for deployment](#getting-environment-vairables-for-deployment))

b. Techzone URL (You got it in [Reserving the techzone instance](#reserving-the-techzone-instance))

c. openspecs file that you updated in last step of previous section.

d. Try the /train and /predict api once the url is deployed, and also set some customers sku empty by trying the /reset_new_customers api

# Common issues and troubleshoot steps:

Sometimes, when you open watsonx orchestrate homepage, the legacy chat is activated and one needs to manually activate AI Chat. Follow steps below to activate AI chat:

1. Click on profile icon in top right and click on settings.

<img width="1000" alt="image" src="./labs/code-engine-deployment/image20.png">

 2. Then click on chat version and switch to AI chat.

    <img width="1000" alt="image" src="../labs/code-engine-deployment/image27.png">