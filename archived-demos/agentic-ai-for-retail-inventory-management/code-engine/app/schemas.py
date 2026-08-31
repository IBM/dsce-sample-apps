from pydantic import BaseModel,RootModel, Field
from typing import Any, Dict, List, Optional
from typing import Union


class TrainRequest(BaseModel):
    """Request model for training. Optionally specify the data directory."""

    # data_dir: str = Field(
    #     "../data", description="Path to the directory containing training CSV files"
    # )
    model_path: Optional[str] = Field(
        "../models",
        description="Optional path to persist the trained model (joblib file). If omitted the model remains only in memory.",
    )
    embed_dim_product: int = Field(
        384, description="Number of components for product text embeddings"
    )
    embed_dim_customer: int = Field(
        384, description="Number of components for customer text embeddings"
    )


class PredictRecord(RootModel[Dict[str, Any]]):  # no model_config here
    """A single sales record for propensity prediction.

    This schema is intentionally permissive and accepts arbitrary fields because
    downstream preprocessing will select only the necessary columns. Users
    should supply the same field names as used during training (see the
    training code for details).
    """
    pass

class PredictRequest(BaseModel):
    """Request model for prediction. Contains a list of sales records."""

    sku_ids:Optional[list]=[]
    customer_ids:Optional[list]=[]
    full_data: Optional[bool] = False


class PredictResponse(BaseModel):
    """Response model for predictions. Returns propensity scores per record."""

    predictions: List[Dict[str, Any]]

class PredictMessage(BaseModel):
    """Response model when only a message is returned."""
    message: str

PredictResponseType = Union[PredictResponse, PredictMessage]


