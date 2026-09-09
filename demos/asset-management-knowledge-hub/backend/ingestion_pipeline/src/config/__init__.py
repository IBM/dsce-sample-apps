"""Ingestion pipeline configuration — extends shared config with COS and app settings."""

from __future__ import annotations

import os

from shared.config import opensearch, watsonx, maximo, cos, app  # re-export

__all__ = ["opensearch", "watsonx", "maximo", "cos", "app"]
