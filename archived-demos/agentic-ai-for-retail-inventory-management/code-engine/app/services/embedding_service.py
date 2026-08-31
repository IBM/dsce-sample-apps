"""
embedding_service.py
--------------------

Functions to convert free-form text into numerical feature vectors ("embeddings") using
scikit-learn utilities. In the absence of heavyweight pre-trained language models,
we employ a simple TF-IDF representation followed by dimensionality reduction via
Truncated SVD (a.k.a. Latent Semantic Analysis). This approach yields dense
embeddings of configurable dimensionality for both product descriptions and
customer profiles.

Note that the semantics of these embeddings are far more rudimentary than those
produced by deep models (e.g. SentenceTransformer), but they still enable us to
incorporate textual information into downstream clustering and modeling.
"""

from typing import Tuple

import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.decomposition import TruncatedSVD


class TextEmbeddingModel:
    """Encapsulate TF-IDF vectorizers and SVD models for text embedding."""

    def __init__(self, n_components_product: int = 10, n_components_customer: int = 10):
        self.n_components_product = n_components_product
        self.n_components_customer = n_components_customer
        self.prod_vectorizer = None  # type: TfidfVectorizer | None
        self.prod_svd = None  # type: TruncatedSVD | None
        self.cust_vectorizer = None  # type: TfidfVectorizer | None
        self.cust_svd = None  # type: TruncatedSVD | None

    def fit(self, product_texts: pd.Series, customer_texts: pd.Series) -> None:
        """Fit vectorizers and SVD models on provided text series.

        Parameters
        ----------
        product_texts : pd.Series
            Series of product description text.
        customer_texts : pd.Series
            Series of customer profile text.
        """
        # Fit TF-IDF on product texts
        self.prod_vectorizer = TfidfVectorizer(stop_words="english")
        prod_tfidf = self.prod_vectorizer.fit_transform(product_texts.fillna("").values)
        
        n_prod_features = prod_tfidf.shape[1]
        actual_n_components_prod = min(self.n_components_product, n_prod_features)
        
        # Reduce dimension via SVD
        self.prod_svd = TruncatedSVD(n_components=actual_n_components_prod, random_state=42)
        self.prod_svd.fit(prod_tfidf)

        # Fit TF-IDF on customer texts
        self.cust_vectorizer = TfidfVectorizer(stop_words="english")
        cust_tfidf = self.cust_vectorizer.fit_transform(customer_texts.fillna("").values)
        
        n_cust_features = cust_tfidf.shape[1]
        actual_n_components_cust = min(self.n_components_customer, n_cust_features)
        
        self.cust_svd = TruncatedSVD(n_components=actual_n_components_cust, random_state=42)
        self.cust_svd.fit(cust_tfidf)
        
        self.n_components_product = actual_n_components_prod
        self.n_components_customer = actual_n_components_cust

    def transform(self, product_texts: pd.Series, customer_texts: pd.Series) -> Tuple[np.ndarray, np.ndarray]:
        """Transform new product and customer texts into embeddings.

        Parameters
        ----------
        product_texts : pd.Series
            Series of product description text.
        customer_texts : pd.Series
            Series of customer profile text.

        Returns
        -------
        Tuple[np.ndarray, np.ndarray]
            A tuple containing product embeddings and customer embeddings. Each
            embedding matrix has shape ``(n_samples, n_components)``.
        """
        # Transform product text
        prod_tfidf = self.prod_vectorizer.transform(product_texts.fillna("").values)
        prod_emb = self.prod_svd.transform(prod_tfidf)
        # Transform customer text
        cust_tfidf = self.cust_vectorizer.transform(customer_texts.fillna("").values)
        cust_emb = self.cust_svd.transform(cust_tfidf)
        return prod_emb, cust_emb


def construct_customer_profiles(df: pd.DataFrame) -> pd.Series:
    """Construct a textual profile for each sales record's customer.

    The profile synthesizes basic demographic and behavioural attributes into a
    human-readable string that is subsequently embedded via TF-IDF/SVD. Missing
    values are handled gracefully by substituting empty strings or zeros where
    appropriate.

    Parameters
    ----------
    df : pd.DataFrame
        DataFrame with columns for name, segment, gender, customer_region,
        income_level, click_email, purchase_frequency, and total_spend.

    Returns
    -------
    pd.Series
        A series of strings representing customer profiles.
    """
    def _format_profile(row) -> str:
        name = row.get("name", "Customer")
        segment = row.get("segment", "").strip() if pd.notnull(row.get("segment")) else ""
        gender = (row.get("gender", "").lower() if pd.notnull(row.get("gender")) else "").strip()
        region = row.get("customer_region", "").strip() if pd.notnull(row.get("customer_region")) else ""
        income = row.get("income_level", "").strip() if pd.notnull(row.get("income_level")) else ""
        click_pct = 0
        try:
            click_pct = int(float(row.get("click_email", 0)) * 100)
        except Exception:
            click_pct = 0
        purchase_freq = row.get("purchase_frequency", 0)
        total_spend = row.get("total_spend", 0)
        return (
            f"{name}, a {segment}-segment {gender} from {region}, {income}-income, "
            f"opens emails {click_pct}%, shops {purchase_freq} times/month, lifetime spend ${total_spend:.0f}."
        )

    profiles = df.apply(_format_profile, axis=1)
    return profiles