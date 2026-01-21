# Setup DataStage

## Introduction
- IBM® DataStage® is an industry-leading data integration solution supporting extract, transform, load (ETL) and extract, load, transform (ELT) patterns. It enables organizations to connect disparate sources, transform large volumes of complex data at scale and deliver trusted data across multicloud and hybrid cloud environments for analytics and AI. You can read more about the offerings in the [official docs](https://www.ibm.com/products/datastage)
- Datastage is used for this usecase to showcase the capability of being able to load data from different sources and transform it into a structure that can be loaded back for use into different data sources

## Prerequisities
- wastonx.data SaaS [instance](https://techzone.ibm.com/my/reservations/create/685acc0400ecf8562ca48ebc)

## Setup 

1. Navigate to IBM Cloud. Click on the hamburger menu in the top left. Select **Resource List**

    <img width="1000" alt="image" src="./assets/ds-1.png">

2. This will show you a list of available resources in your instance. Select **Analytics**, which will give you a list of products. Choose the **DataStage** product.
    
    <img width="1000" alt="image" src="./assets/ds-2.png">

3. This will open up the DataStage page, click on the **Launch in IBM Cloud Pack for Data**
    <img width="1000" alt="image" src="./assets/ds-3.png">

4. This is homepage of Cloud Paka for Data. click on the hamburger menu in the top left to create a new project or view an existing project.
    
    <img width="1000" alt="image" src="./assets/ds-4.png">

5. Then click on **View All Projects**
    
    <img width="1000" alt="image" src="./assets/ds-5.png">

6. The Projects page will open up, click on **New Project+** and then assign any Name to the project and select the COS bucket for storage. 
    
    <img width="1000" alt="image" src="./assets/ds-6.png">
    
    <img width="1000" alt="image" src="./assets/ds-7.png">

7. The Project Page will open up once you it gets craeted. In some cases it will ask you to Create a User API Key, just follow the said commands. Next, go to the Asset Tab

    <img width="1000" alt="image" src="./assets/ds-8.png">

8. Click on **New Asset+** . We are doing this step to import the DB2 that we created in the step earlier into our New Project, to load and transform data.

    <img width="1000" alt="image" src="./assets/ds-9.png">

9. Scroll to and click **Connect to a data source**
    
    <img width="1000" alt="image" src="./assets/ds-10.0.png">

10. In the Search Bar, either search DB2 or scroll until you find DB2, select **IBM Db2**

    <img width="1000" alt="image" src="./assets/ds-10.1.png">

11. The Connection Page for DB2 will open up, first give a name to this asset connection.

    <img width="1000" alt="image" src="./assets/ds-10.2.png">

12. Then add the connection details like **hostname** , **port** , **database_name**

    <img width="1000" alt="image" src="./assets/ds-10.3.png">

13. Let the rest of the details remain default, Add the **Username** and **Password**

    <img width="1000" alt="image" src="./assets/ds-10.4.png">

14. Enable the **Port is SSL Enabled** box, and click on **Test Connection**, if the test is successful, click on **Create**

    <img width="1000" alt="image" src="./assets/ds-10.5.png">

15. Post creation you will be able to see the new asset in the project. To start creating the DataStage flow now, click on **New Asset+** again.

    <img width="1000" alt="image" src="./assets/ds-11.png">

16. Scroll to and select **Transform and integrate data**

    <img width="1000" alt="image" src="./assets/ds-12.png">

17. Give a name to the datastage flow and click on **Create**

    <img width="1000" alt="image" src="./assets/ds-12.1.png">

18. The page for creating the flow will open up. Our first step is to load the data, for this we will click on the  **Connectors** in the left bar, to load data from the different sources that are available, in our case we will use the data asset( db2 connection) that we have imported.

    <img width="1000" alt="image" src="./assets/ds-13.png">

19. Scroll to and select **Asset Connector**, you can also search in the search bar above that says "Find pallette nodes".

    <img width="1000" alt="image" src="./assets/ds-14.png">

20. Once you click on the **Asset Connector** you will see the following screen, click on the **Connection**

    <img width="1000" alt="image" src="./assets/ds-15.0.png">

21. Then click on the connection that we imported

    <img width="1000" alt="image" src="./assets/ds-15.1.png">

22. Either search or scroll to your schema, and click on that schema

    <img width="1000" alt="image" src="./assets/ds-15.2.png">

23. Select all the tables you wan to load, and click on **Add**

    <img width="1000" alt="image" src="./assets/ds-15.3.png">

24. Once you click on **Add**, you will see all the tables on the page like this, if they are not arranged in this way, please make sure you arrange it exactly in this sequence
    
    <img width="1000" alt="image" src="./assets/ds-16.png">

25. The next step is to transform the data, in our case it is to merge the data into a single table hence we will use **Join** to merge our tables.
    Let's focus only on the first two tables for now "credit_scores" and "applicants".
    Click on the **Stages**, in the left menu bar, and either scroll to or search for **Join**
    <img width="1000" alt="image" src="./assets/ds-17.png">

26. Once you've found the **Join** stage, drag and drop it to the workspace between the two tables, and drag the arrows from both the tables towards the join.
    <img width="1000" alt="image" src="./assets/ds-17.0.png">

27. You will have to specify the type of join and the primary key for each join. To be consistent we will be using **Left Join** for all joining purposes
    To add a primary key, Click on **Add Key+**

    <img width="1000" alt="image" src="./assets/ds-18.0.png">
    <img width="1000" alt="image" src="./assets/ds-18.00.png">

28.  Click on **Key+**
    
    <img width="1000" alt="image" src="./assets/ds-18.1.png">

29. Select the key "Applicant_ID" and then click on **Apply**
    
    <img width="1000" alt="image" src="./assets/ds-18.2.png">

30. You will returned to this screen click on **Apply and Return**

    <img width="1000" alt="image" src="./assets/ds-18.3.png">
    
31. You will be returned to the workspace screen, now we will follow the steps from 25–30 again to create the following joins:

    (Credit_Scores)  
    (Join on Applicant_ID)  
    (Applicants)  
    --> **Join 1**

    (Join 1)  
    (Join on Applicant_ID)  
    (Branches)  
    --> **Join 2**

    (Loan_Applicant)  
    (Join on Loan_ID)  
    (Loan_Approvals)  
    --> **Join 3**

    (Join 3)  
    (Join on Applicant_ID)  
    (Repayments)  
    --> **Join 4**

    Finally,

    (Join 2)  
    (Join on Applicant_ID)  
    (Join 4)  
    --> **Join 5**

    All the joins are **Left Outer**.  

    Your final workspace should look like the following:


    <img width="1000" alt="image" src="./assets/ds-19.png">

32. Once the data is transformed, we now have to load it to a Datalake house, we will use the Presto engine that we setup earlier. Click on **Connectors**
    
    <img width="1000" alt="image" src="./assets/ds-20.png">

33. Search for Presto , and then click on **IBM watsonx.data Presto**
    
    <img width="1000" alt="image" src="./assets/ds-21.png">

33. Search for Presto , and then click on **IBM watsonx.data Presto**, drag it to the workspace and connect **Join 2** and **Join 4** to this node. Click on the **IBM watsonx.data Presto** and then click on **Enter Json Snippet**. Paste the connection details we copied earlier.
    
    <img width="1000" alt="image" src="./assets/ds-23.png">

34. Most of the details will already be prefilled, you would need to fill some manually. You are going to need a API key to connect, either create an IAM key or navigate to [techzone][https://techzone.ibm.com/] and go to the .data instance you reserved, scroll down until you find the service id and api key, and copy that api key
     <img width="1000" alt="image" src="./assets/ds-24.png">

35. Paste it here, to connect to the Presto Engine, enable SSL if not enabled already

    <img width="1000" alt="image" src="./assets/ds-25.png">

36. Add the remaining details, and click on save, catalog type `iceberg_data`, for schema type  `loandata2`, for table name type `loan_data`
     
     <img width="1000" alt="image" src="./assets/ds-26.png">

37. Your final flow should look like this
    
    <img width="1000" alt="image" src="./assets/ds-27.png">

37. Click on **Run** and the pipeline should start running, incase you want to view your logs, you can find that on the top-right corner 
    
    <img width="1000" alt="image" src="./assets/ds-28.png">

38. If the pipeline ran successfully, you will be able to see the "Run successful" message

    <img width="1000" alt="image" src="./assets/ds-29.png">

We have now successfully set up and end-to-end ETL pipeline, we will use the tranformed data that is stored in Presto to run an NL2SQL agent using watsonx Orchestrate.


































