# app/agents/reorder.py
import pandas as pd

def apply_reorder_trigger(forecast_df: pd.DataFrame,
                         mode: str = "fixed",
                         threshold: float = 50,
                         stock_df: pd.DataFrame = None,
                         buffer: float = 10) -> pd.DataFrame:
    """
    Add reorder_trigger column based on chosen mode.
    """
    df = forecast_df.copy()
    if mode == "fixed":
        df["reorder_trigger"] = df["yhat"] < threshold
    elif mode == "percent_drop":
        avg_sales = df.groupby("sku")["yhat"].transform("mean")
        df["reorder_trigger"] = df["yhat"] < avg_sales * (1 - threshold / 100)
    elif mode == "stock" and stock_df is not None:
        df = df.merge(stock_df[["sku", "stock"]], on="sku", how="left")
        df["reorder_trigger"] = df["yhat"] > (df["stock"] - buffer)
    else:
        df["reorder_trigger"] = False
    return df

