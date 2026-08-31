"""
clustering_service.py
--------------------

This module houses functions for performing embedding-informed clustering on customers and
SKUs. It relies solely on scikit-learn primitives (KMeans, StandardScaler) and uses
silhouette scores to select the number of clusters. The functions return cluster
assignments that can be appended to the sales DataFrame for downstream modeling.
"""

from typing import Dict, Tuple

import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score


def find_best_k(X: np.ndarray, ks: range) -> Dict[int, float]:
    """Compute silhouette scores for a range of cluster counts.

    Parameters
    ----------
    X : np.ndarray
        The feature matrix to be clustered.
    ks : range
        Range of integers to evaluate as potential numbers of clusters.

    Returns
    -------
    Dict[int, float]
        Mapping from k to its corresponding silhouette score.
    """
    scores = {}
    for k in ks:
        if k <= 1 or k >= X.shape[0]:
            continue
        labels = KMeans(n_clusters=k, random_state=42).fit_predict(X)
        # Silhouette score requires at least 2 clusters and less than number of samples
        try:
            score = silhouette_score(X, labels)
        except Exception:
            score = -1
        scores[k] = score
    return scores


def cluster_customers(
    sales_df: pd.DataFrame,
    cust_embs: np.ndarray,
    cluster_range: range = range(4, 5),
) -> Tuple[pd.Series, int, KMeans, StandardScaler]:
    """Compute customer clusters using numeric features and text embeddings.

    Parameters
    ----------
    sales_df : pd.DataFrame
        The merged sales DataFrame containing customer-level features such as
        ``purchase_frequency``, ``total_spend``, ``usage_freq_num`` and
        ``loyalty_num``.
    cust_embs : np.ndarray
        Customer embedding matrix, with rows aligned to ``sales_df`` rows.
    cluster_range : range, optional
        Range of cluster counts to evaluate for silhouette analysis.

    Returns
    -------
    Tuple[pd.Series, int, KMeans]
        A tuple containing a series of cluster labels indexed by ``customer_id``, the
        best cluster count selected, and the fitted ``KMeans`` model.
    """
    cust_feats = (
        sales_df[[
            "customer_id",
            "purchase_frequency",
            "total_spend",
            "usage_freq_num",
            "loyalty_num",
        ]]
        .drop_duplicates()
        .set_index("customer_id")
    )
    cust_emb_df = (
        pd.DataFrame(
            cust_embs,
            index=sales_df["customer_id"],
            columns=[f"cust_emb_{i}" for i in range(cust_embs.shape[1])],
        )
        .groupby(level=0)
        .mean()
    )
    cust_X = pd.concat([cust_feats, cust_emb_df], axis=1).fillna(0)
    scaler = StandardScaler()
    cust_X_scaled = scaler.fit_transform(cust_X)
    scores = find_best_k(cust_X_scaled, cluster_range)
    best_k = 2 if len(scores) == 0 else max(scores, key=scores.get)
    kmeans = KMeans(n_clusters=best_k, random_state=42)
    labels = kmeans.fit_predict(cust_X_scaled)
    # Return the scaler to allow consistent transformation for new data
    return pd.Series(labels, index=cust_X.index), best_k, kmeans, scaler


def cluster_skus(
    sales_df: pd.DataFrame,
    prod_embs: np.ndarray,
    cluster_range: range = range(2, 7),
) -> Tuple[pd.Series, int, KMeans, StandardScaler]:
    """Compute SKU clusters using numeric features and text embeddings.

    Parameters
    ----------
    sales_df : pd.DataFrame
        The merged sales DataFrame containing SKU-level features such as
        ``current_stock``, ``reorder_threshold`` and ``cost_price``.
    prod_embs : np.ndarray
        Product embedding matrix, with rows aligned to ``sales_df`` rows.
    cluster_range : range, optional
        Range of cluster counts to evaluate for silhouette analysis.

    Returns
    -------
    Tuple[pd.Series, int, KMeans]
        A tuple containing a series of cluster labels indexed by ``sku_id``, the
        best cluster count selected, and the fitted ``KMeans`` model.
    """
    sku_feats = (
        sales_df[[
            "sku_id",
            "current_stock",
            "reorder_threshold",
            "cost_price",
        ]]
        .drop_duplicates()
        .set_index("sku_id")
    )
    sku_emb_df = (
        pd.DataFrame(
            prod_embs,
            index=sales_df["sku_id"],
            columns=[f"prod_emb_{i}" for i in range(prod_embs.shape[1])],
        )
        .groupby(level=0)
        .mean()
    )
    sku_X = pd.concat([sku_feats, sku_emb_df], axis=1).fillna(0)
    scaler = StandardScaler()
    sku_X_scaled = scaler.fit_transform(sku_X)
    scores = find_best_k(sku_X_scaled, cluster_range)
    best_k = 2 if len(scores) == 0 else max(scores, key=scores.get)
    kmeans = KMeans(n_clusters=best_k, random_state=42)
    labels = kmeans.fit_predict(sku_X_scaled)
    return pd.Series(labels, index=sku_X.index), best_k, kmeans, scaler