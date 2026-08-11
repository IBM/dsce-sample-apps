# app/agents/ingestion.py

import pandas as pd
import io

def read_sales_csv(content, expected_cols=None):
    try:
        df = pd.read_csv(io.BytesIO(content))

        if expected_cols:
            missing = set(expected_cols) - set(df.columns)
            if missing:
                raise ValueError(f"Missing columns: {missing}")
        else:
            # Default for sales: ds, sku, y
            required = {"ds", "sku", "y"}
            if not required.issubset(df.columns):
                raise ValueError("CSV must have 'ds', 'sku', and 'y' columns.")

        return df

    except Exception as e:
        raise ValueError(f"CSV parsing failed: {str(e)}")
