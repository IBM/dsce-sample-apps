"""Shared OpenSearch client factory.

Both the MCP server and the ingestion pipeline need an OpenSearch client
configured from the same environment. This module provides a single factory
so connection parameters are never duplicated.

Usage::

    from shared.opensearch import build_client, CLIENT_OPTIONS

    client = build_client()
"""

from __future__ import annotations

from urllib.parse import urlparse

from opensearchpy import OpenSearch

from shared.config import opensearch as cfg
from shared.logging import get_logger

logger = get_logger(__name__)


def _parse_host(url: str) -> dict:
    """Parse a full URL into the host dict that opensearch-py expects.

    opensearch-py ≥ 2.x does not accept a bare URL string in the ``hosts``
    list — it must be a dict with ``host``, ``port``, and ``scheme`` keys.
    Passing the raw URL string causes the library to treat the entire URL
    as a hostname, which results in a 502 from any proxy in front of the
    cluster (the Host header is wrong and the path is mangled).

    Examples
    --------
    >>> _parse_host("https://os.example.com:9200")
    {"host": "os.example.com", "port": 9200, "scheme": "https"}
    >>> _parse_host("https://os.example.com")
    {"host": "os.example.com", "port": 443, "scheme": "https"}
    """
    parsed = urlparse(url)
    scheme = parsed.scheme or "https"
    hostname = parsed.hostname or url
    if parsed.port:
        port = parsed.port
    else:
        port = 443 if scheme == "https" else 9200
    return {"host": hostname, "port": port, "scheme": scheme}


def build_client() -> OpenSearch:
    """Create and return a configured :class:`OpenSearch` client.

    SSL certificate verification is controlled by the
    ``OPENSEARCH_VERIFY_SSL`` environment variable.
    """
    host_dict = _parse_host(cfg.host)
    use_ssl = host_dict["scheme"] == "https"
    client = OpenSearch(
        hosts=[host_dict],
        http_auth=(cfg.username, cfg.password),
        use_ssl=use_ssl,
        verify_certs=cfg.verify_ssl,
        ssl_show_warn=False,
    )
    logger.debug(
        "OpenSearch client created",
        extra={"host": cfg.host, "parsed": host_dict},
    )
    return client
