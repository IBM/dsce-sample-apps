# Trifecta - A multi-vendor GenAI Framework

It is a framework allowing developers to easily configure and invoke GenAI model API calls across vendor platforms. This framework handles all the boilerplate code for integration & exposes various useful endpoints to ease the framework integration with one's frontend application. The framework enables the developer to decouple business logic from the specifics of platform / provider APIs. It also enables the developer to expose certain fields in the prompts to be seen or edited by the user of the solution, e.g. a solution admin.

## Steps to setup the framework

It is assumed that Python3+ is installed or download from <https://www.python.org/downloads/>.

1. Clone the repository on your machine.
2. [Get a watsonx trial account](https://dataplatform.cloud.ibm.com/registration/stepone?context=wx).
3. Create `.env` file in the project root directory and add below provided environment keys.

   ##### Steps to create IBM Cloud API key

   - 3.1 In the [IBM Cloud console](https://cloud.ibm.com/), go to **Manage > Access (IAM) > API keys**
   - 3.2 Click **Create an IBM Cloud API key**
   - 3.3 Enter a name and description for your API key
   - 3.4 Click **Create**
   - 3.5 Then, click **Show** to display the API key. Or, click **Copy** to copy and save it for later, or click **Download**

   ##### Steps to create project_id (skip 3.1 to 3.3 for watsonx trial account)

   - 3.1 In IBM Cloud, [Set up IBM Cloud Object Storage for use with IBM watsonx](https://dataplatform.cloud.ibm.com/docs/content/wsj/console/wdp_admin_cos.html?context=wx&audience=wdp)
   - 3.2 [Set up the Watson Studio and Watson Machine Learning services](https://dataplatform.cloud.ibm.com/docs/content/wsj/getting-started/set-up-ws.html?context=wx&audience=wdp)
   - 3.3 Create a Project from IBM watsonx console - https://dataplatform.cloud.ibm.com/projects/?context=wx
   - 3.4 (Optional step: add more collaborators) Open the Project > Click on **Manage** tab > Click on **Access Control** from the **Manage** tab > Click [Add collaborators](https://dataplatform.cloud.ibm.com/docs/content/wsj/getting-started/collaborate.html?context=wx&audience=wdp#add-collaborators) > **Add Users** > Choose **role** as **Admin** > Click **Add**
   - 3.5 Click on **Manage** tab > Copy the **Project ID** from **General**

   ```sh
   WATSONX_API_KEY=<your IBM Cloud API key>
   WATSONX_PROJECT_ID=<your watsonx instance projectid>
   OPENAI_API_KEY=<Your openai api key>
   APIAUTHCODE=<generate a new uuid for api call authorization>
   #Server running mode. Permissible values True or False
   DEBUG_MODE=False
   ```

   > Reference Online uuid generator tool : <https://www.uuidgenerator.net/>

4. Go to the root directory and prepare your python environment.

   ```sh
   python3 -m venv client-env
   ```

5. Activate the virtual environment:

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

6. Install the required libraries.

   ```sh
   pip3 install -r requirements.txt
   ```

7. Start the framework application.

   ```sh
   python3 main.py
   ```

You can now invoke the application APIs at the following URL.

```sh
http://localhost:8000
```

Checkout the OpenAPI documentation here:

```sh
http://localhost:8000/docs
```

See our OpenAPI documentation here: [View OpenAPI doc](https://ibm.biz/dsce-sample-mvgenai-framework-openapi-doc)

## Framework APIs

All the APIs are protected using the header named `APIAUTHCODE`, framework will block the request if this header is not present in the request by caller.

The API endpoints of this framework are documented below.

1. `GET /get-providers/{ai_task}`

   Get the list of providers based on 'ai_task'. For e.g. the summarization AI task can be supported by models and prompts from multiple platforms providers based on the content of the provider and payload JSON files in the framework.

   Special values for 'ai_task':

   - "all" - to get all available ai tasks

   Examples:

   - Get all providers

   ```sh
   curl --location 'http://localhost:8000/get-providers/all' --header 'APIAUTHCODE: <enter APIAUTHCODE here>'
   ```

   - Get all providers supporting summarization task

   ```sh
   curl --location 'http://localhost:8000/get-providers/summarization' --header 'APIAUTHCODE: <enter APIAUTHCODE here>'
   ```

2. `POST /find-prompt`

   Find the prompt based on input search parameters. The API searches the catalog of prompts in the backend based on the search tags attached to the prompts to find suitable matches.

   Examples:

   - Find the prompt with provider OpenAI and entity-extraction:

   ```sh
   curl --location 'http://localhost:8000/find-prompt' \
   --header 'Content-Type: application/json' \
   --header 'APIAUTHCODE: <enter APIAUTHCODE here>' \
   --data '{
       "provider": "OpenAI",
       "search": ["entity-extraction"]
   }'
   ```

   - Find the prompt with provider watsonx, ai task summarization & model granite-v2:

   ```sh
   curl --location 'http://localhost:8000/find-prompt' \
   --header 'Content-Type: application/json' \
   --header 'APIAUTHCODE: <enter APIAUTHCODE here>' \
   --data '{
       "provider": "watsonx",
       "search": ["summarization", "granite-v2"]
   }'
   ```

3. `POST /find-execute-prompt`

   Find the prompt based on input search parameters, invoke the specific provider API call for inferencing and return results.

   The framework API will invoke provider inferencing API only if a single prompt is found based on search parameters provided. In case multiple prompts are found, the API will return an array of prompts for user to refine the search parameters.

   Examples:

   - Find and execute the prompt with provider watsonx, ai task summarization & model granite-v2:

   ```sh
   curl --location 'http://localhost:8000/find-execute-prompt' \
   --header 'Content-Type: application/json' \
   --header 'APIAUTHCODE: <enter APIAUTHCODE here>' \
   --data-raw '{
   "provider": "watsonx",
   "search": ["summarization", "granite-v2"],
   "input_text": "Agent: Hi there, this is Mary Clare with G2. How is it going today?\nClient: Hi Mary \nAgent: Currently, G2 is working on a new solution to help companies sell more software to their target audiences. Is that something that you would want more information on?\nClient: You can tell me more\nAgent: We have two different approaches to doing this. We either use buyer intent data to identify people who are viewing your profile on G2, or we sell our seasonal reports to businesses so they can use reviews to appeal to potential customers. Which one of those solutions interests you the most?\nClient: Seasonal reports sound like a good idea\nAgent: Great. Can I ask you a few questions before we move forward?\nClient: Sure\nAgent: Which industry segment is of most interest to you ?\nClient: Financial sector\nAgent: I will tell you more about the solution, and then we can make an appointment to explore your options before we wrap up today. Does that sound good?\nClient: Sure. You can send me an email with details.\nAgent: Can you please share your email address ?\nClient: user@abccorp.com"
   }'
   ```

4. `POST /get-examples`

   Get the training examples in a prompt based on input search parameters. This is useful to only show the examples in the prompt so that the developer can present it in the solution UI for end users without exposing rest of the prompt details.

   Examples:

   - Find an example with provider OpenAI and entity-extraction:

   ```sh
   curl --location 'http://localhost:8000/get-examples' \
   --header 'Content-Type: application/json' \
   --header 'APIAUTHCODE: <enter APIAUTHCODE here>' \
   --data '{
       "provider": "OpenAI",
       "search": ["entity-extraction"]
   }'
   ```

   - Find the prompt with provider watsonx, ai task summarization & model granite-v2:

   ```sh
   curl --location 'http://localhost:8000/get-examples' \
   --header 'Content-Type: application/json' \
   --header 'APIAUTHCODE: <enter APIAUTHCODE here>' \
   --data '{
       "provider": "watsonx",
       "search": ["summarization", "granite-v2"]
   }'
   ```

5. `POST /update-examples`

   Set the examples in a prompt. This is useful for end users to provide training examples as domain experts without being exposed to the prompt details that are fixed by the solution developer.

   Examples:

   - Set an example for the prompt having provider OpenAI and task entity-extraction:

   ```sh
   curl --location 'http://localhost:8000/update-examples' \
   --header 'Content-Type: application/json' \
   --header 'APIAUTHCODE: <enter APIAUTHCODE here>' \
   --data-raw '{
      "provider": "watsonx",
      "search": ["entity-extraction"],
      "text": "Input:\nI withdrew $100 from the bank in New York from my phone (345) 123-7867 and email raj@gmail.com. Regards, Raj\nOutput:\nCurrency - $100,\nLocation - New York,\nPhoneNumber - (345) 123-7867,\nPerson - Raj,\nEmail - raj@gmail.com\n"
   }'
   ```

## Framework structure - understanding components of the framework

This section gives details about various components (files/folders) of the framework.

### 1. `providers.json` file

This is a configuration file containing details of platform providers. More entries can be added. It currently contains two ready to use pre-configured providers: watsonx & OpenAI.

The fields in the file are as follows:

- `url` - URL of the inferencing API of the provider
- `apikey` - API Key for authentication when invoking vendor api
- `authtype` - This field can contain either 'key' or 'token' as values.
  Set to 'key', to add your 'apikey' in the request headers as 'Authorization': 'Bearer {apikey}'.
  Set to 'token', to generate IBM authentication token from 'apikey' and add that in request headers.
- `payload_input_var`: The name of input key in provider specific payload.json file.
- `projectid`: watsonx.ai instance project-id

### 2. `payload` directory

This directory contains the provider-specific API payload json files. The naming convention must be followed for the json files in this directory as per the pattern `{provider name declared in providers.json file}-payload.json`

There are two ready-to-use pre-configured payload json files for watsonx & OpenAI. Content of `watsonx-payload.json` is referenced in the framework code whenever the developer chooses `provider:"watsonx"` while invoking any framework API. The details of these provider specific json files are given next.

#### 2.1 `{provider}-payload.json` file

This is a collection of prompt payloads. The following fields are present:

- `payload` (mandatory) - The json payload field which is required by a provider inferencing api call.
- `ai_task` (mandatory) - Name of the AI task performed. This is mainly required for listing supported AI tasks by a provider. For eg: `/get-providers` framework API.
- `search_tags` (mandatory) - This field is used to attach tags to the prompt payload. There is no limit in the number of tags used. This field will be used to find a suitable prompt by all the APIs of the framework. So add everything in this field using which one needs to find a matching prompt. One can even add unique ids to this and use that for searching. For e.g. once a matching prompt is found given various search tags, the id tag can be saved in the application program to do a quick search using the id going forward.

Let's understand how prompt searching works with some examples:

Example 1: To find the prompt with provider watsonx and search tags as summarization and granite-v2.

Equivalent payload

```sh
{
   "provider": "watsonx",
   "search": ["summarization", "granite-v2"]
}
```

Using above payload, the framework will lookup **watsonx**-payload.json for field **search_tags** having all of "summarization" & "granite-v2" and return back the matching **payload** field.

Example 2: To find all the prompts with provider watsonx and search tags as summarization.

Equivalent payload

```sh
{
   "provider": "watsonx",
   "search": ["summarization"]
}
```

Using above payload, the framework will lookup **watsonx**-payload.json for field **search_tags** having "summarization" and return back all the matching **payload** fields.

Example 3: To find the prompt with provider watsonx and search tags as sales-conversation, summarization and granite-v2.

Equivalent payload

```sh
{
   "provider": "watsonx",
   "search": ["sales-conversation", "summarization", "granite-v2"]
}
```

Using above payload, the framework will lookup **watsonx**-payload.json for field **search_tags** having all of "sales-conversation", "summarization", "granite-v2" and return back the matching **payload** field.

Example 4: To find the prompt with provider watsonx and search tags as e1.

Equivalent payload

```sh
{
   "provider": "watsonx",
   "search": ["e1"]
}
```

Using above payload, the framework will lookup **watsonx**-payload.json for field **search_tags** having "e1" and return back the matching **payload** field.

### 3. `core` directory

This directory contains the core framework python files.

#### 3.1 `framework.py` file

This is a python file containing all important core capabilities of the framework. All the APIs ultimately invoke the methods available in this file.

#### 3.2 `payloadParser.py` file

This is a python file abstracting the payload parsing logic from the main framework file. One can create custom parsing logic methods here to override the default parsing logic. For e.g. a parser can extract training examples from a watsonx.ai API payload for viewing/setting examples via API calls.

### 4. `main.py` file

This is the main entrypoint of the framework when deployed on a server. This file contains all the API endpoints exposed by this framework.
