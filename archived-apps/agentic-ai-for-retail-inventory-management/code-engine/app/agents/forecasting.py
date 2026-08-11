from prophet import Prophet
import pandas as pd

def forecast_sales(df):
    # Ensure 'ds', 'y', 'sku' columns exist
    if not {"ds", "y", "sku"}.issubset(df.columns):
        raise ValueError("Input DataFrame must contain 'ds', 'y', and 'sku' columns.")

    forecast_dfs = []
    historical_dfs = []

    for sku, group in df.groupby("sku"):
        model = Prophet()
        model.fit(group[["ds", "y"]])
        future = model.make_future_dataframe(periods=7)  # 7-day forecast
        forecast = model.predict(future)

        forecast = forecast[["ds", "yhat", "yhat_lower", "yhat_upper"]]
        forecast["sku"] = sku
        forecast_dfs.append(forecast)

        hist = group[["ds", "sku", "y"]]
        historical_dfs.append(hist)

    forecast_df = pd.concat(forecast_dfs, ignore_index=True)
    historical_df = pd.concat(historical_dfs, ignore_index=True)

    return {
        "forecast": forecast_df,
        "historical": historical_df
    }
