"""Resource handlers — return configuration and guide content for MCP resources."""

from __future__ import annotations

from mcp_server.src.config import opensearch as cfg


async def handle_opensearch_config() -> dict:
    """Return non-sensitive OpenSearch configuration."""
    return {
        "contents": [{
            "uri": "opensearch://config",
            "mimeType": "application/json",
            "text": __import__("json").dumps({
                "host": cfg.host,
                "index": cfg.index,
                "username": cfg.username,
                "verifySsl": cfg.verify_ssl,
            }, indent=2),
        }]
    }


async def handle_rag_guide() -> dict:
    """Return the RAG usage guide as Markdown."""
    guide = """\
# Maximo RAG Query Guide

## Overview
This MCP server provides RAG (Retrieval-Augmented Generation) capabilities for querying
Maximo maintenance documents stored in OpenSearch.

## Tools

### intelligent-query
Auto-routes to Maximo Live API or document/web RAG based on query intent.

### rag-query
Direct keyword + semantic search over the documents index.

### search-by-asset
Retrieve all document chunks for a specific asset number.

### list-assets
List all asset numbers that have indexed documents.

### get-index-stats
View OpenSearch index statistics.

### test-connection
Verify the OpenSearch connection.

## Document Categories
- **Manual** – Equipment operation and maintenance manuals
- **SOP** – Standard Operating Procedures
- **Troubleshooting** – Troubleshooting guides and procedures

## Example Queries
- "What are the safety precautions for Motor-3003?"
- "How to troubleshoot low pressure in Pump-1001?"
- "Preventive maintenance checklist for Compressor-2002"
"""
    return {
        "contents": [{"uri": "rag://guide/overview", "mimeType": "text/markdown", "text": guide}]
    }


RESOURCE_HANDLERS = {
    "opensearch-config": handle_opensearch_config,
    "rag-guide": handle_rag_guide,
}
