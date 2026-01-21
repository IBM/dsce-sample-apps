import sqlite3
from typing import Optional

import pandas as pd
import os

DB_PATH = "forecast.db"
RETAIL_ANALYTICS_DB_PATH = "./data/retail_analytics.db"


def get_connection() -> sqlite3.Connection:
    """Return a connection to the forecast database."""
    return sqlite3.connect(DB_PATH)

def get_retail_analytics_connection() -> sqlite3.Connection:
    """Return a connection to the retail_analytics database."""
    return sqlite3.connect(RETAIL_ANALYTICS_DB_PATH)

def create_forecast_table(conn):
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS forecasts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ds TEXT,
            sku TEXT,
            yhat REAL,
            yhat_lower REAL,
            yhat_upper REAL,
            reorder_trigger TEXT
        )
    """)
    conn.commit()

def save_forecast_df(conn, forecast_df):
    save_df = forecast_df[["ds", "sku", "yhat", "yhat_lower", "yhat_upper", "reorder_trigger"]].copy()
    save_df.to_sql("forecasts", conn, if_exists="append", index=False)

def get_all_forecasts(conn):
    return pd.read_sql_query("SELECT * FROM forecasts", conn)

def get_forecasts_by_filter(conn, sku=None, start_date=None, end_date=None):
    query = "SELECT * FROM forecasts WHERE 1=1"
    params = []

    if sku:
        query += " AND sku = ?"
        params.append(sku)
    if start_date:
        query += " AND ds >= ?"
        params.append(start_date)
    if end_date:
        query += " AND ds <= ?"
        params.append(end_date)

    return pd.read_sql_query(query, conn, params=params)

def delete_forecasts(conn, sku=None):
    cursor = conn.cursor()
    if sku:
        cursor.execute("DELETE FROM forecasts WHERE sku = ?", (sku,))
    else:
        cursor.execute("DELETE FROM forecasts")
    conn.commit()

def update_reorder_trigger(conn, forecast_id, new_trigger):
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE forecasts SET reorder_trigger = ? WHERE id = ?",
        (new_trigger, forecast_id)
    )
    conn.commit()


def read_tables_from_retail_analytics(conn: sqlite3.Connection, table_name: str, parse_dates: Optional[list] = None) -> pd.DataFrame:
    """
    Reads a table from the given SQLite connection.
    
    Parameters
    ----------
    conn : sqlite3.Connection
        Database connection.
    table_name : str
        Name of the table to read.
    parse_dates : Optional[list]
        List of columns to parse as dates.
        
    Returns
    -------
    pd.DataFrame
        Table contents as a DataFrame.
    """
    try:
        df = pd.read_sql_query(f"SELECT * FROM {table_name}", conn)
        for col in parse_dates:
            if col in df.columns:
                # Parse without microseconds
                df[col] = pd.to_datetime(df[col], errors="coerce").dt.normalize()
                # df[col] = pd.to_datetime(df[col], format="%Y-%m-%d", errors="coerce")
        return df
    except Exception as e:
        raise RuntimeError(f"Failed to read table '{table_name}': {str(e)}")


def save_predictions_to_retail_analytics(conn, preds: list, table_name: str = "propensity_predictions"):
    """
    Save propensity predictions to the retail_analytics database.

    If the table does not exist, it will be created. If a customer_id + sku_id
    combination already exists, the row will be replaced.

    Parameters
    ----------
    conn : sqlite3.Connection
        SQLite database connection.
    preds : list
        List of dictionaries containing prediction results with keys:
        ['customer_id', 'sku_id', 'propensity_score',
         'cust_cluster', 'cust_cluster_explanation',
         'sku_cluster', 'sku_cluster_explanation']
    table_name : str, optional
        Name of the table to store predictions (default = 'propensity_predictions').
    """
    print("123,db \n",preds[0])
    cursor = conn.cursor()
    # cursor.execute("DROP TABLE IF EXISTS propensity_predictions")
    # Create table if not exists
    cursor.execute(f"""
        CREATE TABLE IF NOT EXISTS {table_name} (
            customer_id TEXT,
            sku_id TEXT,
            propensity_score REAL,
            cluster_id INTEGER,
            cluster_info TEXT,
            sku_cluster INTEGER,
            sku_info TEXT,
            PRIMARY KEY (customer_id, sku_id)
        )
    """)
    conn.commit()
    # print(pred)
    # Insert or replace rows
    try:
        for row in preds:
            cursor.execute(f"""
                INSERT OR REPLACE INTO {table_name} (
                    customer_id, sku_id, propensity_score,
                   cluster_id, cluster_info,
                    sku_cluster, sku_info
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                row["customer_id"],
                row["sku_id"],
                row["propensity_score"],
                row["customer_cluster"],
                row["cluster_description"],
                row["sku_cluster"],
                row["sku_description"],
            ))
        conn.commit()
    except Exception as e:
        print("Exception",str(e))


def update_customer_clusters_in_retail_analytics(conn, preds: list):
    """
    Update the customers table with cluster assignments.

    Adds new columns 'cust_cluster' and 'cust_cluster_explanation' if they do not
    already exist. Updates the values for each customer_id provided in preds.

    Parameters
    ----------
    conn : sqlite3.Connection
        SQLite database connection.
    preds : list
        List of dictionaries with keys:
        ['customer_id', 'cust_cluster', 'cust_cluster_explanation']
    """
    cursor = conn.cursor()

    # Check existing columns
    cursor.execute("PRAGMA table_info(customers)")
    existing_cols = [row[1] for row in cursor.fetchall()]

    if "cluster_id" not in existing_cols:
        cursor.execute("ALTER TABLE customers ADD COLUMN cluster_id INTEGER")
    if "cluster_info" not in existing_cols:
        cursor.execute("ALTER TABLE customers ADD COLUMN cluster_info TEXT")

    conn.commit()

    # Update rows
    for row in preds:
        cursor.execute(
            """
            UPDATE customers
            SET cluster_id = ?, cluster_info = ?
            WHERE customer_id = ?
            """,
            (
                row["customer_cluster"],
                row["cluster_description"],
                row["customer_id"],
            ),
        )
    print("201")
    conn.commit()

def update_products_in_retail_analytics(conn,preds:list):
    """
    Update the products table with cluster assignments.

    Adds new columns 'sku_cluster' and 'sku_description' if they do not
    already exist. Updates the values for each sku_id provided in preds.

    Parameters
    ----------
    conn : sqlite3.Connection
        SQLite database connection.
    preds : list
        List of dictionaries with keys:
        ['sku_id', 'sku_cluster', 'sku_description']
    """
    cursor = conn.cursor()

    # Check existing columns
    cursor.execute("PRAGMA table_info(products)")
    existing_cols = [row[1] for row in cursor.fetchall()]

    if "cluster_id" not in existing_cols:
        cursor.execute("ALTER TABLE products ADD COLUMN cluster_id INTEGER")
    if "sku_info" not in existing_cols:
        cursor.execute("ALTER TABLE products ADD COLUMN sku_info TEXT")

    conn.commit()

    # Update rows
    for row in preds:
        cursor.execute(
            """
            UPDATE products
            SET cluster_id = ?, sku_info = ?
            WHERE sku_id = ?
            """,
            (
                row["sku_cluster"],
                row["sku_description"],
                row["sku_id"],
            ),
        )
    conn.commit()

