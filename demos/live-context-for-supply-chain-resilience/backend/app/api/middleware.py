# backend/app/api/middleware.py
# Correlation-ID propagation middleware (spec/08, NFR-001)

from __future__ import annotations
import uuid
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response


class CorrelationIdMiddleware(BaseHTTPMiddleware):
    HEADER = "x-correlation-id"

    async def dispatch(self, request: Request, call_next: Any) -> Response:
        cid = request.headers.get(self.HEADER) or str(uuid.uuid4())
        request.state.correlation_id = cid
        response = await call_next(request)
        response.headers[self.HEADER] = cid
        return response
