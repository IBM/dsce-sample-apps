# backend/app/core/errors.py
# Machine-readable API error helpers – spec/04_API_AND_TOOL_CONTRACTS.yaml

from __future__ import annotations
from fastapi import Request
from fastapi.responses import JSONResponse
from app.domain.models import ApiError, ApiErrorCode


class AppError(Exception):
    def __init__(
        self,
        code: ApiErrorCode,
        message: str,
        retriable: bool = False,
        details: dict | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.retriable = retriable
        self.details = details

    def to_api_error(self, correlation_id: str) -> ApiError:
        return ApiError(
            code=self.code,
            message=str(self),
            retriable=self.retriable,
            correlation_id=correlation_id,
            details=self.details,
        )


async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    correlation_id = request.headers.get("x-correlation-id", "unknown")
    return JSONResponse(
        status_code=_status_for(exc.code),
        content=exc.to_api_error(correlation_id).model_dump(mode="json"),
    )


def _status_for(code: ApiErrorCode) -> int:
    mapping: dict[ApiErrorCode, int] = {
        "NOT_FOUND": 404,
        "INVALID_INPUT": 400,
        "STALE_DATA": 409,
        "CONFLICT": 409,
        "APPROVAL_REQUIRED": 403,
        "APPROVAL_MISMATCH": 409,
        "INSUFFICIENT_INVENTORY": 422,
        "NO_ENGINEERING_EVIDENCE": 422,
        "UPSTREAM_UNAVAILABLE": 503,
        # Supply chain resilience error codes (spec/04 §error_codes)
        "SUPPLIER_CONSTRAINED": 422,
        "AVL_STATUS_CHANGED": 409,
        "RESILIENCE_PROFILE_STALE": 412,
    }
    return mapping.get(code, 500)
