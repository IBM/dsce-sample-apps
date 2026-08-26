# Specification: Retail product website
Starting from an initial draft of the product dataset for Orbital Suppliers' space-related accessories, you need to generate the remaining data.

## Prerequisites

No specific skills are required for this specification. Load any skills that seem relevant — new ones may be added over time.

## Step 1: Review the initial dataset provided
A partial dataset has been provided in @specifications/data.  
* Each product is given an id of `sprocket_###`.  
* Start from this draft schema: @specifications/data/draft_data_schema.md 
* For order checkout, use a flat tax rate of 7.98% and free shipping for all generated orders.
             
## Step 2: Design data architecture
You must design a data architecture that includes the initial dataset provided plus additional data tables and fields required to implement the full functionality of the Orbital Suppliers website.

## Step 3: Users table and login auth
Initial user data is in @specifications/data/users.csv.  Use the following code to generate a `password_hash` for auth validation.  All users have the same password since this is a demo and makes testing easier:
```
import hashlib, hmac
email = "User@Example.com".lower().strip()
text_to_hash = email + "_" +  USER_PASSWORD
digest = hmac.new(PASSWORD_HASH_SECRET.encode(), text_to_hash.encode(), hashlib.sha256).hexdigest()
```
## Step 4: Generate dataset to satisfy website design comps
Design comps for all website pages are at @specifications/frontend/design-mockups/.  Review each page to identify the data required by each page and update your data architecture with any missing fields and relationships.

### Step 5: Missing data required for a comprehensive demo website
The dataset must be comprehensive to support a feature-rich website:
* Generate 3-5 orders per user with 1-5 products/order
* Be random about times, dates and quantity/types of products purchased so the dataset seems realistic.

## Step 6: Import data into Postgres database schema
Load data into the provided Postgres data with name = DB_NAME by creating a new schema as DB_SCHEMA=ai_retail_########, with a random generated 8 digit numbers. 
* Store DB_SCHEMA in @.env
* Do not change existing data stored in other schemas.
* Ensure your new schema does not interfere with any existing schemas.

 

