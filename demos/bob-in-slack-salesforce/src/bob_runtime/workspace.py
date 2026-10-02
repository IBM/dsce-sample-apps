"""Per-tenant filesystem layout for headless Bob runs.

Layout under a single root (a mounted volume in the container):

    <root>/tenants/<tenant>/home                  # HOME for every run of this
                                                  # tenant — Bob's session store
                                                  # (~/.bob/db/bob.db) lives here
    <root>/tenants/<tenant>/sessions/<session>/   # project dir, one per
                                                  # conversation — Bob tasks are
                                                  # keyed by (HOME, project dir),
                                                  # so resume MUST reuse the same
                                                  # directory

Tenant/session names become path components; they are validated to a strict
slug alphabet so callers can pass user-supplied identifiers safely.
"""

from __future__ import annotations

import os
from pathlib import Path
import re

_SLUG = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$")

# Everything a `bob` process is allowed to see. Add deployment-specific names
# through HB_BOB_ENV_EXTRA rather than widening this list.
BOB_ENV_ALLOWLIST = (
    "PATH", "USER", "LOGNAME", "LANG", "LC_ALL", "LC_CTYPE", "TZ", "TMPDIR",
    "BOBSHELL_API_KEY", "BOB_API_KEY", "BOB_LOG_LEVEL", "BOB_GATEWAY_URL",
    "HTTPS_PROXY", "HTTP_PROXY", "NO_PROXY", "https_proxy", "http_proxy", "no_proxy",
    "NODE_EXTRA_CA_CERTS", "SSL_CERT_FILE", "REQUESTS_CA_BUNDLE", "NODE_OPTIONS",
)


def _validate(name: str, what: str) -> str:
    if not _SLUG.match(name) or ".." in name:
        raise ValueError(
            f"Invalid {what} {name!r}: use 1-64 chars of letters, digits, '.', '_', '-'"
        )
    return name


class TenantWorkspace:
    def __init__(self, root: Path, tenant: str):
        self.tenant = _validate(tenant, "tenant")
        self.base = Path(root) / "tenants" / self.tenant

    @property
    def home(self) -> Path:
        return self.base / "home"

    def session_dir(self, session: str) -> Path:
        return self.base / "sessions" / _validate(session, "session")

    def ensure(self, session: str) -> Path:
        """Create tenant HOME + session project dir; returns the project dir."""
        project = self.session_dir(session)
        self.home.mkdir(parents=True, exist_ok=True)
        project.mkdir(parents=True, exist_ok=True)
        return project

    def env(self, base_env: dict[str, str] | None = None) -> dict[str, str]:
        """Environment for a Bob process: an ALLOWLIST, never the inherited env.

        Bob can run shell commands, and whatever a prompt persuades it to run
        can print the environment. So the service's own secrets (Slack tokens,
        integration credentials, export keys) must never be in the child's
        environment. Only what Bob needs crosses over: the Bob API key, PATH,
        locale, temp dir, proxy and CA settings, and Bob's own knobs. HOME is
        pinned to the tenant. Extra names for a deployment go in
        HB_BOB_ENV_EXTRA (comma-separated; a trailing '*' allows a prefix).
        """
        source = base_env if base_env is not None else os.environ
        extra = [e.strip() for e in source.get("HB_BOB_ENV_EXTRA", "").split(",") if e.strip()]
        allowed_exact = set(BOB_ENV_ALLOWLIST) | {e for e in extra if not e.endswith("*")}
        allowed_prefixes = tuple(e[:-1] for e in extra if e.endswith("*"))
        env = {k: v for k, v in source.items()
               if k in allowed_exact or (allowed_prefixes and k.startswith(allowed_prefixes))}
        env["HOME"] = str(self.home)
        return env
