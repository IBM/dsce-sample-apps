"""Cargo API endpoints (already covered in trucks.py but kept for completeness)"""
from fastapi import APIRouter

router = APIRouter()

# Cargo endpoints are implemented in trucks.py:
# - PATCH /api/trucks/{truckId}/cargo-temperature
# - GET /api/trucks/{truckId}/cargo

# Made with Bob
