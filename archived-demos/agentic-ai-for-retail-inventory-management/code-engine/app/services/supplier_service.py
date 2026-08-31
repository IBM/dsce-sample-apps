"""
supplier_service.py
-------------------

Functions related to supplier-level computations such as reliability metrics.
"""

import pandas as pd


def compute_supplier_reliability(reorders: pd.DataFrame) -> pd.DataFrame:
    """Compute supplier reliability based on reorder fulfillment.

    The reliability is defined as the fraction of reorders that are fulfilled for each
    supplier. The function adds a binary ``fulfilled_flag`` column to the reorder
    DataFrame (1 for fulfilled, 0 otherwise) and aggregates over ``supplier_id``.

    Parameters
    ----------
    reorders : pd.DataFrame
        DataFrame containing reorder information with at least ``supplier_id`` and
        ``status`` columns.

    Returns
    -------
    pd.DataFrame
        A two-column DataFrame with ``supplier_id`` and ``supplier_reliability``.
    """
    # Ensure we do not modify the original DataFrame
    reorders = reorders.copy()
    # Create a binary flag: 1 if status is 'fulfilled', else 0
    reorders["fulfilled_flag"] = (reorders["status"] == "fulfilled").astype(int)
    # Compute mean fulfillment per supplier
    reliability = (
        reorders.groupby("supplier_id")["fulfilled_flag"]
        .mean()
        .reset_index()
        .rename(columns={"fulfilled_flag": "supplier_reliability"})
    )
    return reliability