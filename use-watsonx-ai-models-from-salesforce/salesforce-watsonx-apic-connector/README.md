# salesforce-watsonx-apic-connector

Salesforce Open LLM Connector to watsonx.ai.

## Description

This repository contains instructions on how to setup or connect to an IBM API Connect based connector that translates [Salesforce Open LLM Connector specification](https://github.com/salesforce/einstein-platform/blob/main/api-specs/llm-open-connector/llm-open-connector.yml) to watsonx.ai API calls. There are 2 options to use the connector.

1. A multi-tenant connector is already hosted on an IBM API Connect instance on IBM Cloud. It should be used only for PoC and testing. The API calls may be limited, and no high availability or performance guarantees are provided. This should not be used for production.

   Use the following URL to connect to the hosted service. Substitute the `projectid` and `region` parameters based on your watsonx.ai instance.

   ```sh
   https://dsce-apico-12e7a051-gateway-dsce-apiconnect.dsce-ocp-us-south-1-bx2-1-8516f8a0a0d756a8a5eb1ab83a990b56-0000.us-south.containers.appdomain.cloud/dsce-apic/sandbox?projectid=<your-wx-project-id>&region=<your-wx-region>
   ```

   > Note: The hosted connector link may change over time. Please check for the latest URL on this page.

2. Use the code and instructions in this repo to setup your own connector on an IBM API Connect instance.

## Folder structure

[code](./code/) folder contains the connector code files.

- [apic-converter.yml](./code/apic-converter.yml): API design flow exported from IBM API Connect.

- [gatewayscript](./code/gatewayscript/): folder contains javascript code logic for transformation that is used in API Connect GatewayScript policy.

  - [transform_queryparams.js](./code/gatewayscript/transform_queryparams.js): logic to extract query parameters from the request and set them in context variables.
  - [compl_request.js](./code/gatewayscript/compl_request.js) & [compl_response.js](./code/gatewayscript/compl_response.js): logic to transform the request & response payload for `/completions` endpoint.
  - [chat_compl_request.js](./code/gatewayscript/chat_compl_request.js) & [chat_compl_response.js](./code/gatewayscript/chat_compl_response.js): logic to transform the request & response payload for `/chat/completions` endpoint.
  - [embed_request.js](./code/gatewayscript/embed_request.js) & [embed_response.js](./code/gatewayscript/embed_response.js): logic to transform the request & response payload for `/embeddings` endpoint.

[resources](./resources/) folder contains resource documents.

- [llm-open-connector.yml](./resources/llm-open-connector.yml): The connector code is built using this version of the Salesforce Open LLM Connector specification.
- [api-parameters-mapping.pdf](./resources/api-parameters-mapping.pdf): The documentation for mapping parameters from Salesforce Open LLM Connector specification to watsonx.ai API specification.

## Setup steps

1. Pre-requisites:

   - An IBM API Connect SaaS / Software instance. Get a [free trial](https://www.ibm.com/products/api-connect).
     > Note: The current hosted connector uses IBM API Connect software version 10.0.6.0
   - A watsonx.ai instance on IBM cloud ([get a watsonx trial account](https://dataplatform.cloud.ibm.com/registration/stepone?context=wx)).

2. In IBM API Connect manager, add a new API.

   ![image](./images/1%20Create%20New%20API.png)

3. Import the Salesforce Open LLM Connector specification as shown here.

   ![image](./images/2%20Choose%20API%20type.png)

   ![image](./images/3%20Import%20API%20spec%20step1.png)

   ![image](./images/4%20Import%20API%20spec%20step2.png)

   ![image](./images/5%20Edit%20API.png)

4. Switch to 'Source' view.

   ![image](./images/6%20Switch%20to%20source%20view.png)

5. Replace the full source with the content provided in `code/apic-converter.yml` file.

   ![image](./images/7%20Replace%20content,%20Validate%20&%20Save.png)

6. 'Save' the changes.
7. Make the API online.

   ![image](./images/8%20Make%20API%20Online.png)

8. Go to 'Test' tab on the UI to test the API.

   ![image](./images/9%20Test%20API.png)

   Alternatively, use `code/test-connection.js` file from your local machine to test the API.

   ```sh
      node test-connection.js
   ```

9. API Connect is configured with some default properties as shown here.

   ![image](./images/10%20Default%20properties.png)

10. Create a new connection to watsonx.ai model from your Salesforce Einstein Studio using a [recipe](https://opensource.salesforce.com/einstein-platform/ibm).
