import pandas as pd
from sklearn.model_selection import train_test_split
from lightgbm import LGBMClassifier
from sklearn.metrics import classification_report, roc_auc_score
import shap
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error
import matplotlib.pyplot as plt
import joblib,os

model_dir = "models_forecast"
os.makedirs(model_dir, exist_ok=True) 


def check_oos_with_forecast(inventory_df, forecast_df, n=30):
    # Sum forecasted sales over forecast horizon per sku-store
    forecast_sum = (
        forecast_df
        .groupby(['sku_id', 'store_id'])['forecasted_sales']
        .sum()
        .reset_index()
        .rename(columns={'forecasted_sales': 'total_forecasted_demand'})
    )
    
    # Merge with current stock info
    df = inventory_df.merge(forecast_sum, on=['sku_id', 'store_id'], how='left')
    df['total_forecasted_demand'] = df['total_forecasted_demand'].fillna(0)
    
    # Flag items that will go out of stock
    df['will_go_oos'] = df['current_stock'] < df['total_forecasted_demand']
    
    # Calculate average daily forecast
    df['avg_daily_forecast'] = df['total_forecasted_demand'] / int(n)
    
    # Compute days until OOS
    def safe_days_until_oos(row):
        if row['current_stock'] == 0:
            return 0
        if row['avg_daily_forecast'] <= 0:
            return n  # no demand forecasted, no OOS within horizon
        days = row['current_stock'] / row['avg_daily_forecast']
        return int(days) if days > 0 and days != float('inf') else 0
    
    df['days_until_oos'] = df.apply(safe_days_until_oos, axis=1)
    
    return df[['sku_id', 'store_id', 'current_stock', 'total_forecasted_demand', 'will_go_oos', 'days_until_oos']]



def train_days_until_oos_regressor(df,n=30, shap_plot_path="oos_reg.png"):
    # Use only samples that went OOS (label = True)
    df_oos = df[df['will_go_oos'] == True]

    print("48",df_oos.columns)
    
    # Exclude target and identifier columns
    feature_cols = [c for c in df_oos.columns if c not in ['sku_id', 'store_id', 'oos_label', 'days_until_oos', 'will_go_oos']]
    X = df_oos[feature_cols]

    print("52 reg",feature_cols)
    y = df_oos['days_until_oos']
    
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    reg = RandomForestRegressor(random_state=42)
    reg.fit(X_train, y_train)
    
    y_pred = reg.predict(X_test)
    mae = mean_absolute_error(y_test, y_pred)
    rmse = mean_squared_error(y_test, y_pred)
    
    print(f"MAE: {mae:.3f}, RMSE: {rmse:.3f}")
    
    explainer = shap.TreeExplainer(reg)
    shap_values = explainer.shap_values(X_test)
    
    # plt.figure()
    # shap.summary_plot(shap_values, X_test, plot_type="bar", show=False)
    # if shap_plot_path:
    #     plt.savefig(shap_plot_path, bbox_inches='tight')
    #     print(f"SHAP plot saved to {shap_plot_path}")
    # plt.close()
    model_path = os.path.join(model_dir, f"oos_regressor_{n}.pkl")
    joblib.dump(reg, model_path)
    print(f"Reg model saved to {model_path}")
    return reg, explainer, X_test, shap_values


def train_oos_classifier(df,n=30 ,shap_plot_path="oos_clf.png"):
    # Exclude target and identifier columns
    feature_cols = [c for c in df.columns if c not in ['sku_id', 'store_id', 'oos_label', 'will_go_oos', 'days_until_oos']]
    X = df[feature_cols]
    y = df['will_go_oos']
    
    print("Training features:", feature_cols)
    
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    
    clf = LGBMClassifier(random_state=42, predict_disable_shape_check=True)
    clf.fit(X_train, y_train)
    
    y_pred = clf.predict(X_test)
    y_proba = clf.predict_proba(X_test)[:, 1]
    
    print("Classification Report:\n", classification_report(y_test, y_pred))
    print("ROC-AUC Score:", roc_auc_score(y_test, y_proba))

    explainer = shap.TreeExplainer(clf)
    shap_values = explainer.shap_values(X_test)
    
    # plt.figure()
    # shap.summary_plot(shap_values, X_test, plot_type="bar", show=False)
    # if shap_plot_path:
    #     plt.savefig(shap_plot_path, bbox_inches='tight')
    #     print(f"SHAP plot saved to {shap_plot_path}")
    # plt.close()
    model_path = os.path.join(model_dir, f"oos_clf_{n}.pkl")
    joblib.dump(clf, model_path)
    print(f"Classifier model saved to {model_path}")
    return clf, explainer, X_test, shap_values

def predict_oos_and_days_until_oos(
    inventory_df, forecast_df, clf, reg, n=7, sku_ids=[], store_ids=[]
):
    print("119 oos")
    # Merge inventory with forecast
    df = check_oos_with_forecast(inventory_df, forecast_df)
    print("122 df",df)
    print("123",sku_ids,store_ids)
    # Apply filters based on SKU and/or Store
    # If no rows left after filtering
    if df.empty:
        return pd.DataFrame(
            columns=[
                "sku_id",
                "store_id",
                "current_stock",
                "total_forecasted_demand",
                "predicted_oos",
                "oos_probability",
                "predicted_days_until_oos",
            ]
        )

    # Features for prediction
    feature_cols = [
        c
        for c in df.columns
        if c not in ["sku_id", "store_id", "will_go_oos", "days_until_oos"]
    ]
    X = df[feature_cols]
    print("152",X)
    # Predict OOS classification
    oos_proba = clf.predict_proba(X)[:, 1]
    oos_pred = clf.predict(X)

    # Predict days until OOS (clip at n if <=0)
    days_pred = reg.predict(X)
    days_pred = [int(d) if d > 0 else n for d in days_pred]

    # Combine predictions
    df["predicted_oos"] = oos_pred
    df["oos_probability"] = oos_proba
    df["predicted_days_until_oos"] = days_pred

    # sku_store_combos = df.copy()  
    if sku_ids and store_ids:
        print("126 oss in if")
        df = df[
            df['sku_id'].isin(sku_ids) &
            df['store_id'].isin(store_ids)
        ]
    elif sku_ids:
        print("133")
        df = df[df['sku_id'].isin(sku_ids)]
        print(len(df))
    elif store_ids:
        df = df[df['store_id'].isin(store_ids)]
    df=df[df['predicted_days_until_oos']>=7]
    print("130",df)
    return df[
        [
            "sku_id",
            "store_id",
            "current_stock",
            "total_forecasted_demand",
            "predicted_oos",
            "oos_probability",
            "predicted_days_until_oos",
            # "days_until_oos"
        ]
    ]


# def predict_oos_and_days_until_oos(inventory_df, forecast_df, clf, reg,n=7):
#     df = check_oos_with_forecast(inventory_df, forecast_df)
    
#     # Features for prediction exclude target columns
#     feature_cols = [c for c in df.columns if c not in ['sku_id', 'store_id', 'will_go_oos', 'days_until_oos']]
#     X = df[feature_cols]
    
#     # Predict OOS classification
#     oos_proba = clf.predict_proba(X)[:, 1]
#     oos_pred = clf.predict(X)
    
#     # Predict days until OOS using regressor with the same features
#     days_pred = reg.predict(X)
#     days_pred = [int(d) if d > 0 else n for d in days_pred]
    
#     # Combine predictions into result dataframe
#     df['predicted_oos'] = oos_pred
#     df['oos_probability'] = oos_proba
#     df['predicted_days_until_oos'] = days_pred
    
#     return df[['sku_id', 'store_id', 'current_stock', 'total_forecasted_demand',
#                'predicted_oos', 'oos_probability', 'predicted_days_until_oos']]
