#!/usr/bin/env python3
"""
TTM Model Wrapper
Handles loading and inference of Granite TTM (Tiny Time Mixer) model
"""

import os
import numpy as np
import pandas as pd
from typing import Optional
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configuration from .env
TTM_MODEL_PATH = os.getenv("TTM_MODEL_PATH", "ibm-granite/granite-timeseries-ttm-v1")
TTM_MODEL_REVISION = os.getenv("TTM_MODEL_REVISION", "main")
CONTEXT_LENGTH = int(os.getenv("CONTEXT_LENGTH", "512"))
PREDICTION_LENGTH = int(os.getenv("PREDICTION_LENGTH", "96"))
FREQUENCY = os.getenv("FREQUENCY", "1min")
USE_TTM_MODEL = os.getenv("USE_TTM_MODEL", "False").lower() == "true"
DEVICE = os.getenv("DEVICE", "cpu")


class TTMModelWrapper:
    """
    Wrapper for Granite TTM (Tiny Time Mixer) model
    
    This class handles:
    1. Loading the pre-trained TTM model from HuggingFace
    2. Creating a forecasting pipeline
    3. Running predictions on time series data
    """
    
    def __init__(self):
        self.pipeline = None
        self.model_loaded = False
        
    def load_model(self):
        """
        Load TTM model from HuggingFace
        
        This is where the actual model loading happens:
        1. Downloads model from HuggingFace (if not cached)
        2. Initializes TinyTimeMixerForPrediction
        3. Creates TimeSeriesForecastingPipeline
        """
        
        if not USE_TTM_MODEL:
            print("⚠️  TTM model disabled in .env (USE_TTM_MODEL=False)")
            print("   Using mock forecasts for development")
            return
        
        try:
            print(f"🔄 Loading Granite TTM model: {TTM_MODEL_PATH}")
            print(f"   Context Length: {CONTEXT_LENGTH}")
            print(f"   Prediction Length: {PREDICTION_LENGTH}")
            print(f"   Frequency: {FREQUENCY}")
            print(f"   Device: {DEVICE}")
            
            # Import TTM dependencies (only when needed)
            from tsfm_public import TimeSeriesForecastingPipeline, TinyTimeMixerForPrediction
            
            # Load pre-trained model from HuggingFace
            print("   Downloading model from HuggingFace...")
            model = TinyTimeMixerForPrediction.from_pretrained(
                TTM_MODEL_PATH,
                revision=TTM_MODEL_REVISION
            )
            
            # Create forecasting pipeline
            print("   Creating forecasting pipeline...")
            self.pipeline = TimeSeriesForecastingPipeline(
                model=model,
                timestamp_column="timestamp",
                id_columns=["id"],
                target_columns=["value"],
                context_length=CONTEXT_LENGTH,
                prediction_length=PREDICTION_LENGTH,
                freq=FREQUENCY,  # Frequency from .env (e.g., "1min" for cold-chain monitoring)
                device=DEVICE
            )
            
            self.model_loaded = True
            print("✅ TTM model loaded successfully")
            
        except ImportError as e:
            print(f"❌ TTM dependencies not installed: {e}")
            print("   Install with: pip install granite-tsfm torch transformers")
            print("   Using mock forecasts instead")
            
        except Exception as e:
            print(f"❌ Error loading TTM model: {e}")
            print("   Using mock forecasts instead")
    
    def forecast(self, historical_data: pd.DataFrame) -> np.ndarray:
        """
        Generate forecast using TTM model
        
        Args:
            historical_data: DataFrame with columns:
                - timestamp: datetime
                - id: identifier (e.g., truck_id)
                - value: time series value (e.g., temperature)
        
        Returns:
            np.ndarray: Predicted values for next PREDICTION_LENGTH time steps
        
        Example:
            >>> historical_df = pd.DataFrame({
            ...     'timestamp': pd.date_range('2024-01-01', periods=512, freq='1min'),
            ...     'id': ['TRUCK-001'] * 512,
            ...     'value': [2.5, 2.6, 2.4, ...]  # temperatures
            ... })
            >>> predictions = model.forecast(historical_df)
            >>> print(predictions.shape)  # (96,) - next 96 minutes
        """
        
        if not self.model_loaded or self.pipeline is None:
            raise RuntimeError(
                "TTM model not loaded. Either:\n"
                "1. Set USE_TTM_MODEL=true in .env and call load_model()\n"
                "2. Install dependencies: pip install granite-tsfm torch transformers"
            )
        
        try:
            # Validate input data
            required_columns = ['timestamp', 'id', 'value']
            missing_columns = [col for col in required_columns if col not in historical_data.columns]
            if missing_columns:
                raise ValueError(f"Missing required columns: {missing_columns}")
            
            # Ensure we have enough context
            if len(historical_data) < CONTEXT_LENGTH:
                raise ValueError(
                    f"Insufficient data: need {CONTEXT_LENGTH} points, got {len(historical_data)}"
                )
            
            # Use last CONTEXT_LENGTH points for prediction
            context_data = historical_data.tail(CONTEXT_LENGTH).copy()
            
            # Run TTM model prediction
            print(f"   Running TTM forecast on {len(context_data)} data points...")
            predictions = self.pipeline(context_data)
            
            # DEBUG: Print what TTM returned
            print(f"   🔍 TTM output type: {type(predictions)}")
            if isinstance(predictions, dict):
                print(f"   🔍 TTM dict keys: {predictions.keys()}")
            
            # Extract predicted values
            # TTM returns a dict with 'prediction' key containing the forecast
            if isinstance(predictions, dict) and 'prediction' in predictions:
                forecast_values = predictions['prediction']
                print(f"   🔍 Forecast values type: {type(forecast_values)}, shape: {getattr(forecast_values, 'shape', 'N/A')}")
            else:
                forecast_values = predictions
                print(f"   🔍 Direct forecast type: {type(forecast_values)}, shape: {getattr(forecast_values, 'shape', 'N/A')}")
            
            # Convert to numpy array and extract just the values (not timestamps)
            if isinstance(forecast_values, pd.DataFrame):
                print(f"   🔍 DataFrame columns: {forecast_values.columns.tolist()}")
                print(f"   🔍 DataFrame shape: {forecast_values.shape}")
                # If it's a DataFrame, get the prediction column values
                if 'prediction' in forecast_values.columns:
                    forecast_array = forecast_values['prediction'].values
                else:
                    # Get the first numeric column
                    forecast_array = forecast_values.iloc[:, 0].values
            elif isinstance(forecast_values, pd.Series):
                forecast_array = forecast_values.values
            else:
                forecast_array = np.array(forecast_values)
            
            # Ensure it's a 1D array of floats
            forecast_array = np.asarray(forecast_array, dtype=float).flatten()
            
            print(f"   ✅ Generated {len(forecast_array)} predictions")
            return forecast_array
            
        except Exception as e:
            print(f"❌ Error during TTM forecast: {e}")
            raise
    
    def is_loaded(self) -> bool:
        """Check if model is loaded and ready"""
        return self.model_loaded and self.pipeline is not None


# Global instance (singleton pattern)
_ttm_model_instance: Optional[TTMModelWrapper] = None


def get_ttm_model() -> TTMModelWrapper:
    """
    Get global TTM model instance (singleton)
    
    This ensures we only load the model once and reuse it
    for all forecasting requests.
    """
    global _ttm_model_instance
    
    if _ttm_model_instance is None:
        _ttm_model_instance = TTMModelWrapper()
        _ttm_model_instance.load_model()
    
    return _ttm_model_instance


# Example usage
if __name__ == "__main__":
    """
    Test TTM model loading and forecasting
    """
    print("=" * 60)
    print("TTM Model Test")
    print("=" * 60)
    
    # Create model instance
    model = TTMModelWrapper()
    model.load_model()
    
    if model.is_loaded():
        # Create sample data
        print("\n📊 Creating sample time series data...")
        sample_data = pd.DataFrame({
            'timestamp': pd.date_range('2024-01-01', periods=CONTEXT_LENGTH, freq='1min'),
            'id': ['TRUCK-001'] * CONTEXT_LENGTH,
            'value': np.random.randn(CONTEXT_LENGTH) * 2 + 2.5  # Temperature around 2.5°C
        })
        
        print(f"   Data shape: {sample_data.shape}")
        print(f"   Time range: {sample_data['timestamp'].min()} to {sample_data['timestamp'].max()}")
        
        # Generate forecast
        print("\n🔮 Generating forecast...")
        predictions = model.forecast(sample_data)
        
        print(f"   Predictions shape: {predictions.shape}")
        print(f"   Predicted values: {predictions[:5]}... (showing first 5)")
        print("\n✅ Test complete!")
    else:
        print("\n⚠️  Model not loaded - check configuration")

# Made with Bob
