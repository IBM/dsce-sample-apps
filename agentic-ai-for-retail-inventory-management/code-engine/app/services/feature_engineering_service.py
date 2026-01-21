"""
feature_engineering_service.py
-----------------------------

This module contains functions to perform exploratory transformations and feature engineering
necessary for propensity modeling. It merges the various data sources, engineers new
columns such as campaign activity flags and temporal features, and prepares the
combined dataset for downstream modeling. The module deliberately avoids any heavy
learning components (embeddings, clustering, model training) to keep its scope
focused on deterministic data transformation.
"""

from typing import Dict

import pandas as pd


def engineer_features(data: Dict[str, pd.DataFrame], supplier_reliability: pd.DataFrame) -> pd.DataFrame:
    """Merge and engineer features across multiple DataFrames.

    Parameters
    ----------
    data : Dict[str, pd.DataFrame]
        Dictionary containing the raw datasets keyed by names such as ``sales``,
        ``campaigns``, ``inventory``, ``supplier_sku``, ``supplier``, and ``customer``.
    supplier_reliability : pd.DataFrame
        Two-column DataFrame mapping ``supplier_id`` to ``supplier_reliability``.

    Returns
    -------
    pd.DataFrame
        A merged DataFrame containing engineered features ready for embedding,
        clustering and modeling.
    """
    # Unpack input data for easier reference
    sales = data["sales"].copy()
    campaigns = data["campaigns"].copy()
    inventory = data["products"].copy()
    supplier_sku = data["supplier_skus"].copy()
    supplier = data["suppliers"].copy()
    customer = data["customers"].copy()

    # Ensure the binary fulfillment flag exists on the sales table
    if "fulfilled" in sales.columns:
        sales["fulfilled_flag"] = sales["fulfilled"].astype(int)
    elif "fulfilled_flag" not in sales.columns:
        # If no fulfilled column provided, default to zeros
        sales["fulfilled_flag"] = 0

    # ------------------------------------------------------------------
    # Campaign activity merge
    # Build a date-expanded DataFrame of campaign periods per sku
    # Each campaign row is expanded into one row per date in its range
    campaigns_expanded = (
        campaigns.assign(key=1)
        .assign(
            date=lambda df: df.apply(
                lambda r: pd.date_range(r.start_date, r.end_date), axis=1
            )
        )
        .explode("date")
        [["sku_id", "date", "discount_percent", "success_rate"]]
    )

    # Align the sales dates to day-level granularity and join on date and sku
    # ``sale_date`` is already parsed to datetime in data loading stage
    sales["sale_day"] = sales["sale_date"].dt.floor("D")
    sales = sales.merge(
        campaigns_expanded,
        left_on=["sku_id", "sale_day"],
        right_on=["sku_id", "date"],
        how="left",
    )
    # Fill missing campaign features with defaults
    sales["discount_percent"] = sales["discount_percent"].fillna(0)
    sales["success_rate"] = sales["success_rate"].fillna(0)
    # Flag indicating whether a campaign was active
    sales["campaign_active"] = (sales["discount_percent"] > 0).astype(int)

    # ------------------------------------------------------------------
    # Inventory features merge
    inv_feats = inventory[
        [
            "sku_id",
            "product_category",
            "current_stock",
            "reorder_threshold",
            "cost_price",
            "current_selling_price",
            "product_details",
        ]
    ]
    sales = sales.merge(inv_feats, on="sku_id", how="left")

    # ------------------------------------------------------------------
    # Supplier-SKU features merge
    # We drop supplier_id from supplier_sku because it duplicates supplier_id on sales after inventory merge
    sup_sku = supplier_sku.copy()
    sales = sales.merge(
        sup_sku,
        on="sku_id",
        how="left"
    )
    # ------------------------------------------------------------------
    # Supplier info merge
    # Rename region to avoid collision later
    supplier = supplier.rename(columns={"region": "supplier_region"})
    sales = sales.merge(supplier, on="supplier_id", how="left")
    # Join supplier reliability
    sales = sales.merge(supplier_reliability, on="supplier_id", how="left")

    # ------------------------------------------------------------------
    # Customer demographics merge
    # Standardize customer column names for readability and consistency
    customer = customer.rename(
        columns={
            "region": "customer_region",
            "income level": "income_level",
            "click on marketing emails": "click_email",
            "return rate": "return_rate",
            "usage_frequency": "usage_freq",
            "total spend": "total_spend",
        }
    )
    # Select only relevant customer columns for merge
    cust_cols = [
        "customer_id",
        "name",
        "customer_region",
        "segment",
        "gender",
        "income_level",
        "purchase_frequency",
        "click_email",
        "return_rate",
        "usage_freq",
        "total_spend",
        "loyalty",
    ]
    # Some columns may be missing depending on the dataset; drop missing ones
    cust_cols = [c for c in cust_cols if c in customer.columns]
    sales = sales.merge(customer[cust_cols], on="customer_id", how="left")

    # ------------------------------------------------------------------
    # Temporal feature engineering
    # Extract month and day-of-week from sale date for seasonality effects
    sales["sale_month"] = sales["sale_date"].dt.month
    sales["sale_dayofweek"] = sales["sale_date"].dt.dayofweek

    # ------------------------------------------------------------------
    # Convert usage_freq and loyalty to numerical scales (for clustering later)
    # These mappings mirror the original notebook and are applied here for convenience
    usage_map = {"Low": 0, "Medium": 1, "High": 2}
    loyalty_map = {"Bronze": 0, "Silver": 1, "Gold": 2, "Platinum": 3}
    sales["usage_freq_num"] = sales.get("usage_freq").map(usage_map)
    sales["loyalty_num"] = sales.get("loyalty").map(loyalty_map)

    # ------------------------------------------------------------------
    # Drop intermediate or redundant columns
    # Remove columns that will not be used downstream or are no longer meaningful
    sales = sales.drop(
        columns=[
            "status",  # from reorders, not present on sales
            "date",  # join key from campaign expansion
            "sale_day",  # intermediate for campaign join
            "reorder_date",  # only on reorders
            "reorder_fulfilment_date",  # only on reorders
        ],
        errors="ignore",
    )

    return sales