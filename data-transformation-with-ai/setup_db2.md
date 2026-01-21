# Setup Db2

## Introduction
- IBM Db2 is a powerful, AI-enhanced family of data management products by IBM (developed by IBM), serving as a relational database (RDBMS) for mission-critical applications, offering extreme scalability, security, and hybrid cloud support for transactions, analytics, and diverse data types (JSON, XML) across on-premise, cloud, and hybrid environments, known for reliability and handling large workloads. [official docs][https://www.ibm.com/products/db2]
- DB2 is used in this usecase to show that we can load data from a structured DBMS and transform that data in DataStage

## Prerequisities
- wastonx.data SaaS [instance][https://techzone.ibm.com/my/reservations/create/685acc0400ecf8562ca48ebc]

## Setup 

1. Navigate to IBM Cloud. Click on the hamburger menu in the top left. Select **Resource List**

    <img width="1000" alt="image" src="./assets/DB2 connections/1.png">

    <img width="1000" alt="image" src="./assets/DB2 connections/2.png">


2. This will show you a list of available resources in your instance. Select **Databases**, which will give you a list of products. Choose the **Db2** product.
    
    <img width="1000" alt="image" src="./assets/DB2 connections/3.png">

3. This will open up the Db2 page, click on the **Service Credentials** on the left plane
    <img width="1000" alt="image" src="./assets/DB2 connections/4.png">

4. Click on **Create Credentials**
    
    <img width="1000" alt="image" src="./assets/DB2 connections/5.png">

5. It will open a pop up to create service credentials, give the credentials a name, and assign the role of manager and click on **Create**
    
    <img width="1000" alt="image" src="./assets/DB2 connections/6.png">

6. Once it is created, copy the credentials

    <img width="1000" alt="image" src="./assets/DB2 connections/7.png">

7. Scroll to db2 key and copy the username and password, we will be using this to login to the db2

    <img width="1000" alt="image" src="./assets/DB2 connections/8.png">

8. Now go back to the home screen and click on **Manage** , then **Go to UI**

    <img width="1000" alt="image" src="./assets/DB2 connections/9.png">

9. It will now open the login page, use the credentials you copied and paste them in the necessary boxes and click on **Sign In**
    
    <img width="1000" alt="image" src="./assets/DB2 connections/10.png">

10. Once logged in, you will see the following page, click on the **Data** tab to ingest data. You will get the data to injest **[here](./assets/data/)**. Download the data and save it in a folder. Once the Data section opens, you will get the option to Upload files. 

    <img width="1000" alt="image" src="./assets/DB2 data Ingestion/11.png">

11. Go to the folder you have the data saved, and click on any csv you want to upload. We will start with **repayments.csv**

    <img width="1000" alt="image" src="./assets/DB2 data Ingestion/12.png">

12. Once uploaded, click on **Next**

    <img width="1000" alt="image" src="./assets/DB2 data Ingestion/13.png>

13. You will be prompted to choose a schema, if there are multiple, choose the one you want, else go with default and click on **Next**

    <img width="1000" alt="image" src="./assets/DB2 data Ingestion/14.png">

14. Click on **New Table** and add the table name, same as the csv name and click on **Create** and then click on **Next**

    <img width="1000" alt="image" src="./assets/DB2 data Ingestion/15.png">

15. You will be shown a preview of the table, check and click on **Next**

    <img width="1000" alt="image" src="./assets/DB2 data Ingestion/16.png">

16. Finally, you will a brief summary of your table/data, click on **Begin Load** to start creating the table

    <img width="1000" alt="image" src="./assets/DB2 data Ingestion/17.png">

17. Once the load is complete, you will receive a notification and the dashboard will look like the following

    <img width="1000" alt="image" src="./assets/DB2 data Ingestion/18.png">

18. Similarly follow **steps 11 to 17** for all the csv, once you've uploaded all the csv, you should see the following screen

    <img width="1000" alt="image" src="./assets/DB2 data Ingestion/19.png">

## Next steps:
- Setup Datalake House (Presto Engine)
- Setup and run Datastage





























