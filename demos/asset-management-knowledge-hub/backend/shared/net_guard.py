"""Outbound-request guard (SSRF defence) shared by every service that fetches
a caller-influenced URL.

``check_url``  validates a URL (scheme, credentials, port, host allowlist and
               the IPs the host resolves to).
``safe_get``   fetches a URL with the same checks applied to every redirect hop,
               the TCP connection pinned to the already-validated IP (defeats DNS
               rebinding), and caps on response size, content type and duration.

Environment:
    OUTBOUND_ALLOWED_PORTS   comma-separated ports for public fetches (default 80,443)
"""

from __future__ import annotations

import ipaddress
import os
import socket
import time
from dataclasses import dataclass
from fnmatch import fnmatch
from typing import Iterable, Optional
from urllib.parse import urljoin, urlsplit

import requests
from requests.adapters import HTTPAdapter

_SCHEMES = {"http": 80, "https": 443}
_MAX_URL_LENGTH = 2048
_REDIRECT_CODES = {301, 302, 303, 307, 308}

# Ranges that embed an IPv4 address (so is_global alone is not trustworthy).
_EMBEDDING_NETS = (
    ipaddress.ip_network("64:ff9b::/96"),   # NAT64
    ipaddress.ip_network("2002::/16"),      # 6to4
)


# Host names that only make sense inside a cluster, container runtime or LAN.
# Blocked by name in addition to the IP checks (defence in depth) unless private
# targets are explicitly allowed.
_INTERNAL_NAME_PATTERNS = (
    "localhost", "*.localhost", "*.local", "*.localdomain", "*.internal", "*.lan",
    "*.svc", "*.svc.*", "*.cluster.local", "kubernetes.default*",
    "host.docker.internal", "host.containers.internal", "gateway.docker.internal",
)

# Container-runtime / orchestrator management ports; never fetchable by the
# crawler even if OUTBOUND_ALLOWED_PORTS is widened.
_MANAGEMENT_PORTS = {2375, 2376, 2379, 2380, 6443, 8001, 10250, 10255}


class UnsafeURLError(ValueError):
    """The URL (or a redirect target) is not allowed to be fetched."""


@dataclass(frozen=True)
class CheckedURL:
    url: str
    scheme: str
    host: str
    port: int
    ips: tuple[str, ...]


@dataclass(frozen=True)
class FetchedPage:
    url: str
    status: int
    content_type: str
    text: str


def allowed_ports() -> set[int]:
    raw = os.environ.get("OUTBOUND_ALLOWED_PORTS", "")
    ports = {int(p) for p in raw.split(",") if p.strip().isdigit()}
    return ports or {80, 443}


def parse_host_list(raw: str) -> list[str]:
    return [h.strip().lower() for h in raw.split(",") if h.strip()]


# Approved crawl sources when CRAWL_ALLOWED_HOSTS is unset or blank. The crawler
# never runs without an allowlist.
DEFAULT_CRAWL_HOSTS = ("ibm.com", "*.ibm.com", "maximosecrets.com", "*.maximosecrets.com")


def crawl_allowed_hosts() -> list[str]:
    """Approved web-crawl domains: CRAWL_ALLOWED_HOSTS if set, else the defaults."""
    return parse_host_list(os.environ.get("CRAWL_ALLOWED_HOSTS", "")) or list(DEFAULT_CRAWL_HOSTS)


def _ip_blocked(ip: ipaddress.IPv4Address | ipaddress.IPv6Address, allow_private: bool) -> bool:
    if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped:
        ip = ip.ipv4_mapped
    # Never allowed, even for private targets: link-local covers the cloud
    # metadata endpoint (169.254.169.254).
    if ip.is_link_local or ip.is_unspecified or ip.is_multicast or ip.is_reserved:
        return True
    if allow_private:
        return False
    if any(ip in net for net in _EMBEDDING_NETS if net.version == ip.version):
        return True
    return not ip.is_global


def _internal_name(host: str) -> bool:
    """True for single-label names (e.g. ``kubernetes``) and well-known internal suffixes."""
    if "." not in host and ":" not in host:
        return True
    return any(fnmatch(host, pattern) for pattern in _INTERNAL_NAME_PATTERNS)


def _host_allowed(host: str, allowed_hosts: Optional[Iterable[str]]) -> bool:
    if not allowed_hosts:
        return True
    return any(fnmatch(host, pattern) for pattern in allowed_hosts)


def check_url(
    url: str,
    *,
    allow_private: bool = False,
    allowed_hosts: Optional[Iterable[str]] = None,
    resolve: bool = True,
) -> CheckedURL:
    """Validate *url* and return the resolved, vetted addresses.

    ``allow_private`` permits RFC1918/loopback targets (for operator-configured
    systems such as an on-prem Maximo) and lifts the port restriction. Link-local,
    unspecified and multicast targets are rejected regardless.
    ``resolve=False`` performs the syntax checks only (no DNS lookup).
    """
    if not isinstance(url, str) or not url.strip() or len(url) > _MAX_URL_LENGTH:
        raise UnsafeURLError("URL is empty or too long")
    url = url.strip()
    try:
        parts = urlsplit(url)
        port = parts.port
    except ValueError as exc:
        raise UnsafeURLError("URL is malformed") from exc

    if parts.scheme not in _SCHEMES:
        raise UnsafeURLError("Only http and https URLs are allowed")
    if "@" in parts.netloc:
        raise UnsafeURLError("Credentials in URLs are not allowed")
    host = (parts.hostname or "").rstrip(".").lower()
    if not host:
        raise UnsafeURLError("URL has no host")
    port = port or _SCHEMES[parts.scheme]
    if not allow_private and (port not in allowed_ports() or port in _MANAGEMENT_PORTS):
        raise UnsafeURLError("Port is not allowed")
    if not _host_allowed(host, allowed_hosts):
        raise UnsafeURLError("Host is not on the allowlist")

    try:
        literal = ipaddress.ip_address(host)
    except ValueError:
        literal = None

    if literal is None and not allow_private and _internal_name(host):
        raise UnsafeURLError("Internal host names are not allowed")

    if literal is not None:
        if _ip_blocked(literal, allow_private):
            raise UnsafeURLError("Target address is not allowed")
        return CheckedURL(url, parts.scheme, host, port, (str(literal),))
    if not resolve:
        return CheckedURL(url, parts.scheme, host, port, ())

    try:
        infos = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
    except (socket.gaierror, UnicodeError) as exc:
        raise UnsafeURLError("Host could not be resolved") from exc
    ips = tuple(dict.fromkeys(info[4][0].split("%")[0] for info in infos))
    if not ips:
        raise UnsafeURLError("Host could not be resolved")
    for raw_ip in ips:
        if _ip_blocked(ipaddress.ip_address(raw_ip), allow_private):
            raise UnsafeURLError("Target address is not allowed")
    return CheckedURL(url, parts.scheme, host, port, ips)


class _PinnedTLSAdapter(HTTPAdapter):
    """Connect to an IP literal while validating TLS (SNI + certificate) for *hostname*."""

    def __init__(self, hostname: str) -> None:
        self._hostname = hostname
        super().__init__()

    def init_poolmanager(self, connections, maxsize, block=False, **pool_kwargs):  # type: ignore[override]
        pool_kwargs["server_hostname"] = self._hostname
        pool_kwargs["assert_hostname"] = self._hostname
        super().init_poolmanager(connections, maxsize, block, **pool_kwargs)


def _pinned_request_args(target: CheckedURL) -> tuple[requests.Session, str, str]:
    """Return (session, url_with_ip, host_header) for a single vetted hop."""
    ip = target.ips[0]
    ip_netloc = f"[{ip}]" if ":" in ip else ip
    default_port = _SCHEMES[target.scheme]
    if target.port != default_port:
        ip_netloc += f":{target.port}"

    parts = urlsplit(target.url)
    host_header = target.host if target.port == default_port else f"{target.host}:{target.port}"
    pinned = parts._replace(netloc=ip_netloc).geturl()

    session = requests.Session()
    session.trust_env = False        # no env proxies: the proxy would re-resolve the host
    if target.scheme == "https":
        session.mount("https://", _PinnedTLSAdapter(target.host))
    return session, pinned, host_header


def safe_get(
    url: str,
    *,
    headers: Optional[dict[str, str]] = None,
    timeout: float = 15,
    total_timeout: float = 30,
    max_bytes: int = 2_000_000,
    max_redirects: int = 3,
    allowed_hosts: Optional[Iterable[str]] = None,
    content_types: tuple[str, ...] = ("text/html", "application/xhtml+xml", "text/plain"),
) -> FetchedPage:
    """GET *url*, enforcing the SSRF policy on every hop. Raises on any violation."""
    deadline = time.monotonic() + total_timeout
    current = url
    for _ in range(max_redirects + 1):
        target = check_url(current, allowed_hosts=allowed_hosts)
        session, pinned_url, host_header = _pinned_request_args(target)
        try:
            resp = session.get(
                pinned_url,
                headers={**(headers or {}), "Host": host_header},
                timeout=timeout,
                allow_redirects=False,
                stream=True,
            )
            with resp:
                if resp.status_code in _REDIRECT_CODES and resp.headers.get("Location"):
                    current = urljoin(target.url, resp.headers["Location"])
                    continue
                resp.raise_for_status()

                content_type = resp.headers.get("Content-Type", "").split(";")[0].strip().lower()
                if content_type and content_type not in content_types:
                    raise UnsafeURLError("Unsupported content type")

                body = bytearray()
                for piece in resp.iter_content(chunk_size=8192):
                    body.extend(piece)
                    if len(body) > max_bytes:
                        raise UnsafeURLError("Response too large")
                    if time.monotonic() > deadline:
                        raise UnsafeURLError("Fetch took too long")
                text = bytes(body).decode(resp.encoding or "utf-8", errors="replace")
                return FetchedPage(target.url, resp.status_code, content_type, text)
        finally:
            session.close()
    raise UnsafeURLError("Too many redirects")
