"""
model_service.py
----------------

Services for constructing, tuning, evaluating and persisting propensity models.
The module makes heavy use of scikit-learn and LightGBM primitives to build
pipelines that handle imputation, discretization, scaling, encoding and
classification. It deliberately avoids imbalanced-learn due to environment
constraints and instead leverages LightGBM's built-in ``scale_pos_weight``
parameter to account for class imbalance.

The primary entry point is ``train_model`` which accepts a fully engineered
DataFrame (including embeddings and cluster labels) and returns a fitted model
together with cross-validation metrics. Additional helper functions are provided
for evaluating and persisting models.
"""

from typing import Dict, List, Tuple

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.metrics import roc_auc_score, roc_curve
from sklearn.model_selection import RandomizedSearchCV, StratifiedKFold, cross_val_score, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import KBinsDiscretizer, OneHotEncoder, StandardScaler
from lightgbm import LGBMClassifier


def build_preprocessor(numeric_feats: List[str], categorical_feats: List[str]) -> ColumnTransformer:
    """Construct a scikit-learn ``ColumnTransformer`` for preprocessing features.

    Parameters
    ----------
    numeric_feats : List[str]
        Names of numeric feature columns.
    categorical_feats : List[str]
        Names of categorical feature columns.

    Returns
    -------
    ColumnTransformer
        Preprocessor that imputes missing values, discretizes continuous variables
        (into quantile bins) and scales them, and one-hot encodes categorical
        variables.
    """
    # Numeric pipeline: impute missing with median, discretize into 5 quantile bins, then standardize
    num_pipe = Pipeline([
        ("impute", SimpleImputer(strategy="median")),
        ("kbins", KBinsDiscretizer(n_bins=5, encode="ordinal", strategy="quantile")),
        ("scale", StandardScaler()),
    ])
    # Categorical pipeline: impute missing with a constant and one-hot encode
    cat_pipe = Pipeline([
        ("impute", SimpleImputer(strategy="constant", fill_value="missing")),
        ("onehot", OneHotEncoder(handle_unknown="ignore")),
    ])
    return ColumnTransformer([
        ("num", num_pipe, numeric_feats),
        ("cat", cat_pipe, categorical_feats),
    ])


def train_model(
    df: pd.DataFrame,
    target_col: str = "fulfilled_flag",
    model_path: str =".models/",
    random_seed: int = 42,
    n_iter: int = 20,
    cv_splits: int = 3,
) -> Tuple[Pipeline, Dict[str, float], Dict[str, object]]:
    """Train a propensity model on the provided DataFrame.

    This function performs the following steps:

    1. Identify numeric and categorical features based on column names.
    2. Build a preprocessing pipeline to handle missing values, discretization,
       scaling and one-hot encoding.
    3. Define a LightGBM classifier with class imbalance handling via
       ``scale_pos_weight``.
    4. Perform hyperparameter tuning using ``RandomizedSearchCV``.
    5. Fit the best pipeline on the full training data.
    6. Optionally persist the best model to disk.

    Parameters
    ----------
    df : pd.DataFrame
        Fully engineered DataFrame containing features, embeddings, cluster labels
        and the target column.
    target_col : str, default 'fulfilled_flag'
        Name of the binary target column.
    model_path : str | None, optional
        If provided, the fitted model will be persisted to this path via joblib.
    random_seed : int, default 42
        Seed for reproducibility.
    n_iter : int, default 20
        Number of parameter settings sampled in the random search.
    cv_splits : int, default 3
        Number of cross-validation folds used during hyperparameter tuning.

    Returns
    -------
    Tuple[Pipeline, Dict[str, float], Dict[str, object]]
        The fitted pipeline, a dictionary of cross-validation metrics, and the
        best hyperparameters identified by the search.
    """
    # Separate features and target
    exclude = [target_col, "customer_id", "sku_id"]
    features = [c for c in df.columns if c not in exclude]
    X = df[features].copy()
    y = df[target_col].copy()

    # Identify numeric and categorical features heuristically
    # All object and category dtype columns are treated as categorical
    numeric_feats = X.select_dtypes(include=[np.number]).columns.tolist()
    categorical_feats = X.select_dtypes(exclude=[np.number]).columns.tolist()

    # Remove target-excluded numeric fields from numeric list
    numeric_feats = [f for f in numeric_feats if f not in exclude]

    # Build preprocessing pipeline
    preprocessor = build_preprocessor(numeric_feats, categorical_feats)

    # Handle class imbalance using scale_pos_weight
    pos_count = y.sum()
    neg_count = len(y) - pos_count
    # Avoid division by zero
    scale_pos_weight = (neg_count / pos_count) if pos_count > 0 else 1.0

    # Define base classifier
    clf = LGBMClassifier(
        objective="binary",
        metric="auc",
        random_state=random_seed,
        verbose=-1,
        scale_pos_weight=scale_pos_weight,
    )

    # Combine into a pipeline
    pipe = Pipeline([
        ("preproc", preprocessor),
        ("clf", clf),
    ])

    # Define parameter distributions for tuning
    param_dist = {
        "clf__num_leaves": [31, 50, 100],
        "clf__max_depth": [-1, 10, 20],
        "clf__learning_rate": [0.01, 0.05, 0.1],
        "clf__feature_fraction": [0.6, 0.8, 1.0],
        "clf__bagging_fraction": [0.6, 0.8, 1.0],
    }

    # Split into train/test for tuning
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, stratify=y, random_state=random_seed
    )

    # Randomized search over hyperparameters
    search = RandomizedSearchCV(
        pipe,
        param_distributions=param_dist,
        n_iter=n_iter,
        cv=cv_splits,
        scoring="roc_auc",
        n_jobs=1,
        random_state=random_seed,
    )
    search.fit(X_train, y_train)

    # Extract best estimator
    best_model = search.best_estimator_

    # Evaluate on full data via cross-validation
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=random_seed)
    cv_scores = cross_val_score(
        best_model, X, y, cv=cv, scoring="roc_auc", n_jobs=1
    )

    metrics = {
        "cv_scores": cv_scores.tolist(),
        "cv_mean": float(np.mean(cv_scores)),
        "best_cv_score": float(search.best_score_),
    }

    # # Persist model if path provided
    # if model_path:
    #     joblib.dump(best_model, model_path)
    

    return best_model, metrics, search.best_params_


def predict_propensity(model: Pipeline, X: pd.DataFrame) -> np.ndarray:
    """Predict propensity scores using a fitted pipeline.

    Parameters
    ----------
    model : Pipeline
        A fitted scikit-learn pipeline with a classifier supporting ``predict_proba``.
    X : pd.DataFrame
        DataFrame containing feature columns matching those used during training.

    Returns
    -------
    np.ndarray
        Array of propensity scores in the range [0, 1].
    """
    return model.predict_proba(X)[:, 1]