# app/main.py

import warnings
import pandas as pd
import time

warnings.filterwarnings(
    "ignore", category=UserWarning, module="sklearn.preprocessing._discretization"
)
warnings.filterwarnings("ignore", category=pd.errors.PerformanceWarning)


from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse
from app.agents.ingestion import read_sales_csv
from app.agents.forecasting import forecast_sales
from app.agents.reorder import apply_reorder_trigger
from app.agents.optimizer import optimize_reorder_plan
from app.db import (
    get_connection,
    create_forecast_table,
    save_forecast_df,
    save_predictions_to_retail_analytics,
    get_retail_analytics_connection,
    update_customer_clusters_in_retail_analytics
)

from app.services.data_service import load_data_from_retail_analytics_db
from app.services.supplier_service import compute_supplier_reliability
from app.services.feature_engineering_service import engineer_features
from app.services.embedding_service import (
    TextEmbeddingModel,
    construct_customer_profiles,
)
from app.services.clustering_service import (
    cluster_customers,
    cluster_skus,
)
from app.services.model_service import train_model, predict_propensity
from app.config.cluster_info import (
    customer_cluster_explanations,
    sku_cluster_explanations,
)
from typing import Any, Dict, List, Optional
import pandas as pd
import traceback
from app.schemas import PredictRequest, PredictResponse, TrainRequest

app = FastAPI()

# -----------------------------------------------------------------------------
# Global state for trained objects
# These will be populated when the /train endpoint is invoked
# -----------------------------------------------------------------------------
EMBEDDING_MODEL: Optional[TextEmbeddingModel] = None
MODEL: Optional[Any] = None  # fitted sklearn Pipeline
KMEANS_CUST: Optional[Any] = None  # fitted KMeans for customers
SCALER_CUST: Optional[Any] = None  # fitted StandardScaler for customer clustering
KMEANS_SKU: Optional[Any] = None  # fitted KMeans for skus
SCALER_SKU: Optional[Any] = None  # fitted StandardScaler for sku clustering



@app.on_event("startup")
def startup():
    conn = get_connection()
    create_forecast_table(conn)
    conn.close()

@app.post("/forecast")
async def forecast_endpoint(
    file: UploadFile = File(...),
    reorder_mode: str = Form("fixed"),
    threshold: float = Form(50),
    buffer: float = Form(10),
    stock_file: UploadFile = File(None),
    constraint_file: UploadFile = File(None)
):
    try:
        contents = await file.read()
        df = read_sales_csv(contents)  # Default expects ds, sku, y
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=f"CSV parsing failed: {str(e)}")

    try:
        result = forecast_sales(df)
        historical_df = result["historical"]
        forecast_df = result["forecast"]
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Forecasting failed: {str(e)}")

    stock_df = None
    if stock_file:
        try:
            stock_contents = await stock_file.read()
            stock_df = read_sales_csv(stock_contents, expected_cols=["sku", "stock"])
        except Exception as e:
            traceback.print_exc()
            raise HTTPException(status_code=400, detail=f"Stock CSV parsing failed: {str(e)}")

    if constraint_file:
        try:
            constraint_contents = await constraint_file.read()
            constraint_df = read_sales_csv(constraint_contents, expected_cols=["sku", "min_qty", "stockout_risk"])
            forecast_df = forecast_df.merge(constraint_df, on="sku", how="left")
        except Exception as e:
            traceback.print_exc()
            raise HTTPException(status_code=400, detail=f"Constraint CSV parsing failed: {str(e)}")

    try:
        forecast_df = apply_reorder_trigger(forecast_df, reorder_mode, threshold, stock_df, buffer)
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Applying reorder logic failed: {str(e)}")

    if "unit_cost" not in forecast_df.columns:
        forecast_df["unit_cost"] = 100.0
    if "min_qty" not in forecast_df.columns:
        forecast_df["min_qty"] = 1
    if "stockout_risk" not in forecast_df.columns:
        forecast_df["stockout_risk"] = 0.5

    try:
        conn = get_connection()
        save_forecast_df(conn, forecast_df)
        conn.close()
    except Exception as e:
        traceback.print_exc()

    forecast_df["ds"] = forecast_df["ds"].astype(str)
    historical_df["ds"] = historical_df["ds"].astype(str)

    return JSONResponse(content={
        "historical": historical_df.to_dict(orient="records"),
        "forecast": forecast_df[["ds", "sku", "yhat", "yhat_lower", "yhat_upper", "reorder_trigger", "unit_cost", "min_qty", "stockout_risk"]].to_dict(orient="records")
    })

@app.post("/optimize")
async def optimize_endpoint(data: dict):
    try:
        forecast_df = pd.DataFrame(data["forecast"])
        if "unit_cost" not in forecast_df.columns:
            forecast_df["unit_cost"] = 100.0
        if "min_qty" not in forecast_df.columns:
            forecast_df["min_qty"] = 1
        if "stockout_risk" not in forecast_df.columns:
            forecast_df["stockout_risk"] = 0.5

        optimized_df = optimize_reorder_plan(forecast_df)
        return JSONResponse(content=optimized_df.to_dict(orient="records"))
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Optimization failed: {str(e)}")

@app.post("/train")
def train_endpoint(req: TrainRequest) -> Dict[str, Any]:
    """Train the propensity model.

    This endpoint orchestrates loading the raw data, computing supplier
    reliability, merging datasets with engineered features, constructing text
    embeddings, performing embedding-informed clustering, and training a
    LightGBM-based propensity model. The resulting model, embedding transformers
    and clustering models are stored in the application's global state.

    Parameters
    ----------
    req : TrainRequest
        JSON payload specifying the data directory, optional model save path and
        embedding dimensions.

    Returns
    -------
    Dict[str, Any]
        A summary of training metrics and model parameters.
    """
    global EMBEDDING_MODEL, MODEL, KMEANS_CUST, SCALER_CUST, KMEANS_SKU, SCALER_SKU

    # Load raw datasets
    data = load_data_from_retail_analytics_db()

    # Compute supplier reliability
    supplier_rel = compute_supplier_reliability(data["reorders"])

    # Merge and engineer deterministic features
    sales_df = engineer_features(data, supplier_rel)

    # --- Save engineered features for reuse ---
    try:
        conn_feat = get_retail_analytics_connection()
        sales_df.to_sql(
            "engineered_features", conn_feat, if_exists="replace", index=False
        )
        conn_feat.close()
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to persist engineered features: {str(e)}"
        )
    # Construct customer profiles for embedding
    sales_df["cust_profile"] = construct_customer_profiles(sales_df)

    # Instantiate and fit embedding model
    embedding_model = TextEmbeddingModel(
        n_components_product=req.embed_dim_product,
        n_components_customer=req.embed_dim_customer,
    )
    embedding_model.fit(
        product_texts=sales_df["product_details"],
        customer_texts=sales_df["cust_profile"],
    )
    # Transform texts into embeddings
    prod_embs, cust_embs = embedding_model.transform(
        product_texts=sales_df["product_details"],
        customer_texts=sales_df["cust_profile"],
    )
    # Append embedding features to DataFrame
    for i in range(prod_embs.shape[1]):
        sales_df[f"prod_emb_{i}"] = prod_embs[:, i]
    for i in range(cust_embs.shape[1]):
        sales_df[f"cust_emb_{i}"] = cust_embs[:, i]

    # Drop raw text columns as they are now encoded
    sales_df = sales_df.drop(columns=["product_details", "cust_profile"], errors="ignore")

    # Perform clustering on customers
    cust_labels, best_k_c, kmeans_c, scaler_c = cluster_customers(
        sales_df, cust_embs
    )
    # Map cluster labels back to sales DataFrame
    sales_df["cust_cluster"] = sales_df["customer_id"].map(cust_labels)

    # Perform clustering on SKUs
    sku_labels, best_k_s, kmeans_s, scaler_s = cluster_skus(
        sales_df, prod_embs
    )
    sales_df["sku_cluster"] = sales_df["sku_id"].map(sku_labels)

    # Persist embedding model and clustering models in global state
    EMBEDDING_MODEL = embedding_model
    KMEANS_CUST = kmeans_c
    SCALER_CUST = scaler_c
    KMEANS_SKU = kmeans_s
    SCALER_SKU = scaler_s
    start_time = time.time()
    print("Starting model training...")

    # Train the predictive model
    model, metrics, best_params = train_model(
        sales_df,
        target_col="fulfilled_flag",
        model_path=req.model_path,
    )
    MODEL = model
    end_time = time.time()  # end timer
    training_time = end_time - start_time  # elapsed time in seconds

    print(f"Model training complete in {training_time:.2f} seconds")
    # Return metrics and parameters
    return {
        "training_complete": True,
        "cv_scores": metrics["cv_scores"],
        "cv_mean": metrics["cv_mean"],
        "best_cv_score": metrics["best_cv_score"],
        "best_params": best_params,
        "customer_clusters": int(best_k_c),
        "sku_clusters": int(best_k_s),
    }

@app.post("/predict", response_model=PredictResponse)
def predict_endpoint(req: PredictRequest) -> PredictResponse:
    """Predict propensity scores for arbitrary sales records.

    This endpoint requires that the ``/train`` endpoint has been called at least
    once in order to have a trained model and associated embedding and
    clustering transformers. Incoming records are minimally validated and
    transformed to match the feature schema expected by the model. Missing
    fields will be imputed according to the preprocessing pipeline defined
    during training.

    Parameters
    ----------
    req : PredictRequest
        Request containing a list of records to score.

    Returns
    -------
    PredictResponse
        List of propensity scores keyed by their corresponding identifiers.
    """
    if MODEL is None or EMBEDDING_MODEL is None:
        raise HTTPException(status_code=400, detail="Model has not been trained yet")

    # Convert input records to DataFrame
    if req.records:
        raw_records = req.records
        df_new = pd.DataFrame(raw_records)

    # Case 2: request full dataset
    elif req.full_data:
        try:
            conn_feat = get_retail_analytics_connection()
            df_new = pd.read_sql_query("SELECT * FROM engineered_features", conn_feat)
            conn_feat.close()
        except Exception as e:
            raise HTTPException(
                status_code=500, detail=f"Failed to load engineered features: {str(e)}"
            )
        raw_records = df_new.to_dict(orient="records")

    else:
        raise HTTPException(
            status_code=400, detail="Either provide `records` or set `full_data=true`."
        )

    # Check for identifiers
    if "customer_id" not in df_new.columns or "sku_id" not in df_new.columns:
        raise HTTPException(
            status_code=400,
            detail="Each record must contain at least 'customer_id' and 'sku_id' keys",
        )

    # Ensure numeric mappings exist for usage_freq and loyalty if provided
    usage_map = {"Low": 0, "Medium": 1, "High": 2}
    loyalty_map = {"Bronze": 0, "Silver": 1, "Gold": 2, "Platinum": 3}
    if "usage_freq" in df_new.columns:
        df_new["usage_freq_num"] = df_new["usage_freq"].map(usage_map)
    else:
        df_new["usage_freq_num"] = 0
    if "loyalty" in df_new.columns:
        df_new["loyalty_num"] = df_new["loyalty"].map(loyalty_map)
    else:
        df_new["loyalty_num"] = 0

    # Construct customer profiles and compute embeddings
    df_new["cust_profile"] = construct_customer_profiles(df_new)
    prod_embs_new, cust_embs_new = EMBEDDING_MODEL.transform(
        product_texts=df_new.get("product_details", pd.Series([""] * len(df_new))),
        customer_texts=df_new["cust_profile"],
    )
    for i in range(prod_embs_new.shape[1]):
        df_new[f"prod_emb_{i}"] = prod_embs_new[:, i]
    for i in range(cust_embs_new.shape[1]):
        df_new[f"cust_emb_{i}"] = cust_embs_new[:, i]

    # Assign cluster labels using stored kmeans models and scalers
    # Customer clustering
    # Build feature matrix for clustering: purchase_frequency, total_spend, usage_freq_num, loyalty_num and customer embeddings
    cust_feat_cols = [
        "purchase_frequency",
        "total_spend",
        "usage_freq_num",
        "loyalty_num",
    ]
    # Fill missing numeric values with zeros
    cust_features = df_new[cust_feat_cols].fillna(0)
    # Append embeddings for customers
    cust_emb_cols = [f"cust_emb_{i}" for i in range(cust_embs_new.shape[1])]
    cust_features = pd.concat([cust_features, df_new[cust_emb_cols]], axis=1)
    # Scale using training scaler
    cust_scaled = SCALER_CUST.transform(cust_features)
    cust_cluster_labels = KMEANS_CUST.predict(cust_scaled)
    df_new["cust_cluster"] = cust_cluster_labels
    # SKU clustering
    sku_feat_cols = [
        "current_stock",
        "reorder_threshold",
        "cost_price",
    ]
    sku_features = df_new[sku_feat_cols].fillna(0)
    sku_emb_cols = [f"prod_emb_{i}" for i in range(prod_embs_new.shape[1])]
    sku_features = pd.concat([sku_features, df_new[sku_emb_cols]], axis=1)
    sku_scaled = SCALER_SKU.transform(sku_features)
    sku_cluster_labels = KMEANS_SKU.predict(sku_scaled)
    df_new["sku_cluster"] = sku_cluster_labels

    # Prepare final feature set by dropping raw text and unused columns
    df_new = df_new.drop(columns=["product_details", "cust_profile"], errors="ignore")

    # Identify columns used during training
    # Remove any extraneous columns not seen during training pipeline
    # We assume MODEL has feature names extracted from its preprocessor; if not available we
    # simply pass all columns to prediction
    # For consistency, we fill missing numeric and categorical values per pipeline
    # Predictions will be handled by MODEL's internal preprocessing
    propensity_scores = predict_propensity(MODEL, df_new)

    # Build response entries
    preds = []
    for idx, score in enumerate(propensity_scores):
        record = raw_records[idx]
        cust_cluster_val = int(df_new.loc[idx, "cust_cluster"])
        sku_cluster_val = int(df_new.loc[idx, "sku_cluster"])

        preds.append(
            {
                "customer_id": record.get("customer_id"),
                "sku_id": record.get("sku_id"),
                "propensity_score": float(score),
                "cust_cluster": cust_cluster_val,
                "cust_cluster_explanation": customer_cluster_explanations.get(
                    cust_cluster_val, "No explanation available"
                ),
                "sku_cluster": sku_cluster_val,
                "sku_cluster_explanation": sku_cluster_explanations.get(
                    sku_cluster_val, "No explanation available"
                ),
            }
        )

    # --- Handle output storage depending on mode ---
    if req.records or req.full_data:
        try:
            with get_retail_analytics_connection() as conn:
            # if req.records:
                save_predictions_to_retail_analytics(conn, preds)
                update_customer_clusters_in_retail_analytics(conn, preds)

            # if req.full_data:
                save_predictions_to_retail_analytics(conn, preds)
                update_customer_clusters_in_retail_analytics(conn, preds)

        except Exception as exc:
            raise HTTPException(
                status_code=500,
                detail=f"Database operation failed: {str(exc)}"
            )

    return PredictResponse(predictions=preds)