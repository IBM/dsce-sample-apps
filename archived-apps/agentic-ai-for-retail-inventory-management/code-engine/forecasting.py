# forecast_model.py
import os
import json
import joblib
from pathlib import Path

import pandas as pd
import numpy as np
import lightgbm as lgb
from sklearn.metrics import mean_squared_error
from datetime import timedelta
import shap
import matplotlib.pyplot as plt


def get_active_campaign(campaigns, date, sku_id):
    # Ensure datetime conversion
    campaigns = campaigns.copy()
    campaigns["start_date"] = pd.to_datetime(campaigns["start_date"])
    campaigns["end_date"] = pd.to_datetime(campaigns["end_date"])
    active = campaigns[
        (campaigns['sku_id'] == sku_id) &
        (campaigns['start_date'] <= date) &
        (campaigns['end_date'] >= date)
    ]
    if not active.empty:
        return [float(active.iloc[0]['discount_percent']), float(active.iloc[0]['success_rate'])]
    return [0.0, 0.0]

# ---------------------
# Data preparation
# ---------------------
def prepare_sales_df(sales, campaigns, propensity_df):
    """
    Expects:
      - sales with columns: sale_date (datetime), sku_id, quantity
      - campaigns with: sku_id, start_date, end_date, discount_percent, success_rate
      - propensity_df with: sku_id, propensity_score
    Returns a dataframe with features and target.
    """
    df = sales.groupby(["sale_date", "sku_id","store_id"])["quantity"].sum().reset_index()
    df = df.rename(columns={"sale_date": "date", "quantity": "sales"})
    df['date'] = pd.to_datetime(df['date'])
    df = df.sort_values(["sku_id", "date"])
    df['lag_1'] = df.groupby("sku_id")["sales"].shift(1)

    # date features
    df['day_of_week'] = df['date'].dt.dayofweek
    df['is_weekend'] = df['day_of_week'].isin([5, 6]).astype(int)
    df['month'] = df['date'].dt.month

    # campaign features (vectorized via apply)
    campaign_vals = df.apply(
        lambda row: pd.Series(get_active_campaign(campaigns, row['date'], row['sku_id'])),
        axis=1
    )
    campaign_vals.columns = ["discount_percent", "success_rate"]
    df = pd.concat([df.reset_index(drop=True), campaign_vals.reset_index(drop=True)], axis=1)

    # propensity
    if propensity_df is None or propensity_df.empty:
        df['propensity_score'] = 0.0
    else:
        df = df.merge(propensity_df, on="sku_id", how="left")
        # fill missing propensity with mean
        if "propensity_score" not in df.columns or df["propensity_score"].isna().any():
            df["propensity_score"] = df["propensity_score"].fillna(propensity_df["propensity_score"].mean())

    # drop rows without lag_1 (can't train on first row)
    df = df.dropna(subset=["lag_1"]).reset_index(drop=True)
    return df

# ---------------------
# Train, save, load
# ---------------------
def train_and_save_model(df, features, target, model_path="model.joblib", params=None, mlflow_client=None):
    """
    Train a LightGBM model and save model + metadata (features list).
    """
    if params is None:
        params = {"n_estimators": 200, "learning_rate": 0.05}

    # time-based split
    df = df.sort_values("date")
    split_date = df["date"].quantile(0.8)
    train_df = df[df["date"] <= split_date]
    test_df = df[df["date"] > split_date]

    X_train = train_df[features]
    y_train = train_df[target]
    X_test = test_df[features]
    y_test = test_df[target]

    model = lgb.LGBMRegressor(**params)
    model.fit(X_train, y_train)

    # evaluation
    y_pred = model.predict(X_test)
    rmse = float(np.sqrt(mean_squared_error(y_test, y_pred)))

    # persist model and metadata
    out_dir = Path(model_path).parent or Path(".")
    out_dir.mkdir(parents=True, exist_ok=True)

    joblib.dump(model, model_path)

    metadata = {
        "features": features,
        "target": target,
        "params": params,
        "train_rows": len(train_df),
        "test_rows": len(test_df),
        "rmse": rmse
    }
    meta_path = str(Path(model_path).with_suffix(".meta.json"))
    with open(meta_path, "w") as f:
        json.dump(metadata, f, indent=2, default=str)

    # optional MLflow logging if client provided
    if mlflow_client:
        try:
            mlflow_client.log_metric("rmse", rmse)
            mlflow_client.log_params(params)
            mlflow_client.log_artifact(model_path, artifact_path="model")
            mlflow_client.log_artifact(meta_path, artifact_path="model")
        except Exception:
            pass

    return {"model_path": model_path, "meta_path": meta_path, "rmse": rmse}


def load_model_and_meta(model_path="model.joblib"):
    model = joblib.load(model_path)
    meta_path = str(Path(model_path).with_suffix(".meta.json"))
    with open(meta_path, "r") as f:
        metadata = json.load(f)
    return model, metadata




def compute_and_save_shap(model, X, out_dir="shap_outputs", prefix="shap"):
    """
    Computes SHAP values for X (pd.DataFrame). Saves:
      - shap_values.csv
      - shap_summary.png (bar)
    Returns paths.
    """
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)

    # TreeExplainer works with LGBM
    explainer = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(X)
    # convert to DataFrame
    shap_df = pd.DataFrame(shap_values, columns=X.columns)
    shap_csv = out / f"{prefix}_values.csv"
    shap_df.to_csv(shap_csv, index=False)

    # summary plot
    plt.figure(figsize=(8, 6))
    shap.summary_plot(shap_values, X, plot_type="bar", show=False)
    plt.tight_layout()
    summary_png = out / f"{prefix}_summary.png"
    plt.savefig(summary_png)
    plt.close()

    return {"shap_csv": str(shap_csv), "shap_summary_png": str(summary_png)}


def log_production_batch_metrics(new_batch_sales, model, features, metrics_log_path="production_metrics.csv"):
    """
    new_batch_sales: DataFrame with columns date, sku_id, quantity (actual).
    It computes predictions for the available rows and appends RMSE per SKU to a CSV.
    """
    new_batch = new_batch_sales.copy()
    new_batch = new_batch.rename(columns={"sale_date": "date", "quantity": "sales"}) if "sale_date" in new_batch.columns else new_batch
    new_batch['date'] = pd.to_datetime(new_batch['date'])

    rows = []
    for sku, g in new_batch.groupby("sku_id"):
        # prepare feature rows for predictions: use previous day's sales as lag_1 where possible
        g = g.sort_values("date")
        preds = []
        truths = []
        for idx, row in g.iterrows():
            # for production, you must compute the features similarly to training (including campaign/propensity)
            # Here we assume the new_batch provides lag_1 already OR you extend this function to fetch last known sales
            if "lag_1" not in row or pd.isna(row.get("lag_1", np.nan)):
                # skip rows without lag_1 (or you can set lag_1 equal to previous truth)
                continue
            feat_row = pd.DataFrame([{
                "lag_1": row["lag_1"],
                "day_of_week": row["date"].dayofweek,
                "is_weekend": 1 if row["date"].dayofweek in [5, 6] else 0,
                "month": row["date"].month,
                "discount_percent": row.get("discount_percent", 0.0),
                "success_rate": row.get("success_rate", 0.0),
                "propensity_score": row.get("propensity_score", 0.0)
            }])
            feat_row = feat_row[features]
            p = model.predict(feat_row)[0]
            preds.append(p)
            truths.append(row["sales"])

        if len(truths) == 0:
            continue
        rmse = float(np.sqrt(mean_squared_error(truths, preds)))
        rows.append({"sku_id": sku, "n": len(truths), "rmse": rmse, "timestamp": pd.Timestamp.now().isoformat()})

    if rows:
        dfm = pd.DataFrame(rows)
        if os.path.exists(metrics_log_path):
            dfm.to_csv(metrics_log_path, mode="a", header=False, index=False)
        else:
            dfm.to_csv(metrics_log_path, index=False)
    return rows



# def get_forecast(inventory,sales,campaigns,propensity_df,start_date,n,store_id,sku_id):
#     # prepare
#     df = prepare_sales_df(sales.rename(columns={"sale_date": "sale_date"}).assign(sale_date=sales["sale_date"]), campaigns, propensity_df)
#     features = ["lag_1", "day_of_week", "is_weekend", "month", "discount_percent", "success_rate", "propensity_score"]
#     target = "sales"
#     print("328")
#     # load
#     model, meta = load_model_and_meta("models_forecast/lgbm_demo.joblib")
#     print("Loaded meta:", meta)
#     print("421",df.columns)
#     df.rename(columns={"date":"sale_date"},inplace=True)
#     print("421",df.columns)
#     # forecast example for sku 101 for starting date
#     preds, shap_input = forecast_next_n_days_with_model(df, campaigns, propensity_df, model, features, sku_id,start_date,store_id,n)
#     print(preds)
#     return preds,shap_input


def get_predicted_forecast(inventory_df,sales_df,campaigns_df,propensity_df,start_date,n=30,sku_ids=None,store_ids=None):
    forecast_grid = pd.DataFrame()
    sku_store_combos = inventory_df[['sku_id', 'store_id']].drop_duplicates().reset_index(drop=True)
    # Aggregate propensity_df to get mean score per SKU
    propensity_mean = propensity_df.groupby("sku_id", as_index=False)["propensity_score"].mean()

    # Merge with SKU/store combos
    sku_store_combos = sku_store_combos.merge(propensity_mean, on="sku_id", how="left")

    # Optional: fill missing propensity with 0
    sku_store_combos["propensity_score"] = sku_store_combos["propensity_score"].fillna(0.0)

    # Get last known sales as initial lag_1
    last_sales = (
        sales_df.groupby(["sku_id", "store_id"], as_index=False)
        .apply(lambda g: g.loc[g["sale_date"].idxmax(), ["sku_id", "store_id", "quantity"]])
        .reset_index(drop=True)
        .rename(columns={"quantity": "lag_1"})
    )
    print(last_sales)
    sku_store_combos = sku_store_combos.merge(last_sales, on=["sku_id", "store_id"], how="left")
    print(len(sku_store_combos))
    if sku_ids and store_ids:
        sku_store_combos=sku_store_combos[(sku_store_combos['sku_id'].isin(sku_ids)) & (sku_store_combos['store_id'].isin(store_ids))]
    elif sku_ids:
        print("263")
        sku_store_combos=sku_store_combos[sku_store_combos['sku_id'].isin(sku_ids)]
        print(len(sku_store_combos))
    elif store_ids:
        sku_store_combos=sku_store_combos[sku_store_combos['store_id'].isin(store_ids)]
    print(len(sku_store_combos))
    model, meta = load_model_and_meta("models_forecast/lgbm_demo.joblib")
    # Sequential forecast
    for i in range(n):
        forecast_date = start_date + timedelta(days=i)
        
        # copy combos and add date
        daily_grid = sku_store_combos.copy()
        daily_grid["date"] = forecast_date
        print(len(daily_grid))
        # Add temporal features
        daily_grid["day_of_week"] = forecast_date.dayofweek
        daily_grid["is_weekend"] = daily_grid["day_of_week"].apply(lambda x: int(x in [5,6]))
        daily_grid["month"] = forecast_date.month
        # Apply row-wise
        campaign_values = daily_grid.apply(
        lambda row: get_active_campaign(campaigns_df, forecast_date, row["sku_id"]),
        axis=1
    )

        # campaign_values is a Series of tuples, split into columns
        daily_grid["discount_percent"] = campaign_values.apply(lambda x: x[0])
        daily_grid["success_rate"] = campaign_values.apply(lambda x: x[1])
        features = ["lag_1", "day_of_week", "is_weekend", "month",
                    "discount_percent", "success_rate", "propensity_score"]
        # Predict using your model (features must include lag_1 + other features)
        X = daily_grid[features]
        daily_grid["forecasted_sales"] = model.predict(X)
        
        # Save today's forecast
        forecast_grid = pd.concat([forecast_grid, daily_grid], ignore_index=True)
        
        # Update lag_1 for the next day with today's predicted sales
        sku_store_combos["lag_1"] = daily_grid["forecasted_sales"]
    return forecast_grid
        
        