#!/usr/bin/env python3
"""backend/run.py – start the development server"""
import uvicorn
from app.core.config import settings

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=settings.port, reload=True)
