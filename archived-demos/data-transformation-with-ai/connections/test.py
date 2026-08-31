import prestodb
import os
from dotenv import load_dotenv
import pandas as pd

# Load env vars
load_dotenv()

CATALOG = os.getenv("PRESTO_CATALOG", "iceberg_data")
SCHEMA = os.getenv("PRESTO_SCHEMA", "originbankschema")

def get_connection():
    return prestodb.dbapi.connect(
        host=os.getenv("PRESTO_HOST"),
        port=int(os.getenv("PRESTO_PORT")),
        user=os.getenv("PRESTO_USER"),
        catalog=CATALOG,
        schema=SCHEMA,
        auth=prestodb.auth.BasicAuthentication(
            os.getenv("PRESTO_USER"),
            os.getenv("PRESTO_PASSWORD")
        ),
        http_scheme=os.getenv("PRESTO_HTTP_SCHEME", "https"),
    )

def run_sql(sql):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(sql)
    rows = cur.fetchall()
    cols = [desc[0] for desc in cur.description]
    return pd.DataFrame(rows, columns=cols)

if __name__ == "__main__":
    try:
        print("=== Checking available catalogs ===")
        print(run_sql("SHOW CATALOGS"), "\n")

        print(f"=== Checking schemas in catalog '{CATALOG}' ===")
        print(run_sql(f"SHOW SCHEMAS FROM {CATALOG}"), "\n")

        print(f"=== Checking tables in schema '{CATALOG}.{SCHEMA}' ===")
        print(run_sql(f"SHOW TABLES FROM {CATALOG}.{SCHEMA}"), "\n")

        print(f"=== Fetching data from '{CATALOG}.{SCHEMA}.originbanktable' ===")
        result = run_sql("SELECT * FROM iceberg_data.originbankschema.originbanktable LIMIT 5")
        result = run_sql("SELECT * FROM iceberg_data.originbankschema.originbanktable FETCH FIRST 5 ROWS ONLY")


        # iceberg_data'.'originbankschema'.'originbanktable







        print(result)

    except Exception as e:
        print("Error:", e)

