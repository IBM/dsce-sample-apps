"""Shared-secret API-key authentication for the backend services.

A pure ASGI middleware (so it never buffers Server-Sent-Event streams) that
rejects every request lacking the configured ``API_KEY``. It fails closed: if no
key is configured, every non-exempt request is refused.

The key is accepted as ``X-API-Key: <key>`` or ``Authorization: Bearer <key>``.
``/health`` and CORS pre-flight ``OPTIONS`` requests are exempt.

Optional admin gate: when ``admin_check`` is given, matching requests must also
present ``X-Admin-Key: <ADMIN_API_KEY>``. The front-end proxy only adds that header
for the administrator account, so other UI users cannot reach those routes. It
fails closed too: with no ``ADMIN_API_KEY`` configured, matching requests get 403.

Failed authentication is logged (never the presented secret) so brute-force and
probing attempts are visible.
"""

from __future__ import annotations

import hmac
import json
import os
import re
from typing import Callable, Optional

from shared.logging import get_logger

logger = get_logger(__name__)

_EXEMPT_PATHS = {"/health"}
_SAFE_LABEL = re.compile(r"[^A-Za-z0-9._:@-]")


def _label(value: bytes | str | None) -> str:
    if isinstance(value, bytes):
        value = value.decode("latin-1")
    return _SAFE_LABEL.sub("?", (value or "")[:64])


def client_info(scope) -> tuple[str, str]:
    """Return (user, address) for logging and rate limiting.

    ``X-Auth-User`` / ``X-Real-IP`` are set by the front-end proxy, which replaces
    any client-supplied values. Both are sanitised so they cannot forge log lines.
    """
    headers = {name: value for name, value in scope["headers"]}
    peer = (scope.get("client") or ("", 0))[0]
    return _label(headers.get(b"x-auth-user")) or "-", _label(headers.get(b"x-real-ip") or peer) or "-"


class ApiKeyMiddleware:
    def __init__(
        self,
        app,
        api_key: str | None = None,
        admin_key: str | None = None,
        admin_check: Optional[Callable[[str, str], bool]] = None,
    ) -> None:
        self.app = app
        self._key = (api_key if api_key is not None else os.environ.get("API_KEY", "")).encode()
        self._admin_key = (admin_key if admin_key is not None else os.environ.get("ADMIN_API_KEY", "")).encode()
        self._admin_check = admin_check
        if not self._key:
            logger.error("API_KEY is not set — all non-health requests will be rejected")
        if admin_check and not self._admin_key:
            logger.error("ADMIN_API_KEY is not set — admin-only routes will be rejected")

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope["method"] == "OPTIONS" or scope["path"] in _EXEMPT_PATHS:
            await self.app(scope, receive, send)
            return

        if not self._matches(scope, (b"x-api-key",), self._key, bearer=True):
            self._log_denied(scope, 401)
            await self._reject(send, 401, "Unauthorized", {b"www-authenticate": b"Bearer"})
            return

        if self._admin_check and self._admin_check(scope["method"], scope["path"]):
            if not self._matches(scope, (b"x-admin-key",), self._admin_key):
                self._log_denied(scope, 403)
                await self._reject(send, 403, "Administrator access required")
                return

        await self.app(scope, receive, send)

    @staticmethod
    def _matches(scope, header_names: tuple[bytes, ...], expected: bytes, bearer: bool = False) -> bool:
        if not expected:
            return False
        presented = b""
        for name, value in scope["headers"]:
            if name in header_names:
                presented = value
                break
            if bearer and name == b"authorization" and value[:7].lower() == b"bearer ":
                presented = value[7:].strip()
                break
        return hmac.compare_digest(presented, expected)

    @staticmethod
    def _log_denied(scope, status: int) -> None:
        user, addr = client_info(scope)
        logger.warning("Request denied", extra={
            "status": status,
            "client": addr,
            "user": user,
            "http_method": scope["method"],
            "route": _label(scope["path"]),
        })

    @staticmethod
    async def _reject(send, status: int, detail: str, extra_headers: dict[bytes, bytes] | None = None) -> None:
        body = json.dumps({"detail": detail}).encode()
        headers = [
            (b"content-type", b"application/json"),
            (b"content-length", str(len(body)).encode()),
        ]
        headers.extend((extra_headers or {}).items())
        await send({"type": "http.response.start", "status": status, "headers": headers})
        await send({"type": "http.response.body", "body": body})
