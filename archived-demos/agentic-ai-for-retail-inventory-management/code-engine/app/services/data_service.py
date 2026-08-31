"""
data_service.py
-----------------

This module provides functions to load the raw datasets used for propensity modeling.
All datasets are expected to reside in the retail_analytics db). Dates are parsed into pandas datetime columns where appropriate.

The service exposes a single ``load_data`` function that returns a dictionary
containing each of the DataFrames keyed by a descriptive name.
"""

from pathlib import Path
from typing import Dict

import pandas as pd

from app.db import get_retail_analytics_connection, read_tables_from_retail_analytics

def load_data_from_retail_analytics_db() -> Dict[str, pd.DataFrame]:
    table_info = {
        "reorders": {"parse_dates": ["reorder_date", "reorder_fulfilment_date"]},
        "sales": {"parse_dates": ["sale_date"]},
        "customers": {"parse_dates": ["birthdate", "last_purchase_date"]},
        "suppliers": {"parse_dates": []},
        "supplier_skus": {"parse_dates": []},
        "campaigns": {"parse_dates": ["start_date", "end_date"]},
        "products": {"parse_dates": []},
    }

    data = {}
    try:
        with get_retail_analytics_connection() as conn:
            for table_name in table_info.keys():
                df = read_tables_from_retail_analytics(
                    conn,
                    table_name,
                    parse_dates=table_info[table_name]["parse_dates"]  # always a list
                )
                data[table_name] = df

    except Exception as e:
        raise RuntimeError(f"Failed to load training data from DB: {str(e)}")
    print("43",data)
    return data