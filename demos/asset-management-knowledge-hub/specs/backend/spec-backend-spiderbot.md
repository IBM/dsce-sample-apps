# SPEC-004 — Backend: Spiderbot (Web Crawler)

**Version:** 1.0  
**Status:** Approved  
**Domain:** Asset Management  
**Location:** `backend/spiderbot/`  
**Skills Required:** `opensearch-vector-search`

---

## 1. Business Requirements

| ID | Requirement |
|----|-------------|
| BR-001 | The system must continuously crawl and index IBM Maximo documentation, IBM Support articles, and community knowledge (Maximo Secrets, blogs) to supplement the document RAG index. |
| BR-002 | Web-crawled knowledge must be stored in a separate OpenSearch index (`maximo_web_knowledge`) to allow separate relevance tuning. |
| BR-003 | The crawler must deduplicate pages by URL to avoid redundant content in the index. |
| BR-004 | The crawler must support configurable site lists, incremental re-crawls, and forced full re-crawls. |
| BR-005 | Crawled content must include structured metadata: source URL, page title, site label, and topic. |

---

## 2. Technology Stack

| Component | Technology |
|-----------|-----------|
| Runtime | Python 3.11+ |
| Browser Automation | Playwright (Chromium) |
| HTTP Scraping | httpx / requests (for static pages) |
| Index | IBM watsonx.data OpenSearch (`opensearch-py`) |

---

## 3. CLI Commands

```bash
# Full crawl of all configured sites
python -m spiderbot crawl

# Dry run — preview URLs without writing anything
python -m spiderbot crawl --dry-run

# Crawl only sites matching a label substring
python -m spiderbot crawl --filter "MAS CLI"

# Force re-crawl of already-indexed pages
python -m spiderbot crawl --force

# Show current index statistics
python -m spiderbot stats
```

---

## 4. Crawl Architecture

### 4.1 Pipeline

```
Site configuration (URL list, selectors, topic labels)
    │
    │  1. Discover pages
    ▼
Crawler (Playwright or httpx)
  - Renders JavaScript for dynamic IBM Docs pages
  - Extracts page title, main content, navigation labels
  - Respects robots.txt and rate limits
    │
    │  2. Deduplicate
    ▼
Registry check — has this URL hash been indexed?
    │
    │  3. Index
    ▼
IBM watsonx.data OpenSearch
  - Index: maximo_web_knowledge
  - One document per crawled page
```

### 4.2 Crawl Page Document Schema

```python
@dataclass
class WebPage:
    url: str           # canonical page URL (collapsed field for dedup)
    title: str         # page title from <title> or <h1>
    site_label: str    # human-readable site name e.g. "IBM Docs – MAS"
    topic: str         # topic category e.g. "maintenance", "configuration"
    content: str       # extracted main body text
    crawled_at: str    # ISO 8601 UTC
    content_hash: str  # SHA-256 of content for change detection
```

### 4.3 Configured Crawl Sources

| Site Label | URL Pattern | Content Type |
|------------|------------|--------------|
| IBM Docs – MAS | `https://www.ibm.com/docs/en/mas-cd` | IBM product docs |
| IBM Docs – Maximo Manage | `https://www.ibm.com/docs/en/maximo-manage` | IBM product docs |
| IBM Support – Maximo | `https://www.ibm.com/support/pages/...` | Support articles |
| Maximo Secrets | `https://maximosecrets.com` | Community tips and tricks |
| Community Blogs | Configurable list | Community blogs |

---

## 5. OpenSearch Index: `maximo_web_knowledge`

> **Skill:** `opensearch-vector-search`

**Index mapping:**
```json
{
  "mappings": {
    "properties": {
      "url":         { "type": "keyword" },
      "title":       { "type": "text", "fields": { "keyword": { "type": "keyword" } } },
      "siteLabel":   { "type": "keyword" },
      "topic":       { "type": "keyword" },
      "content":     { "type": "text", "analyzer": "english" },
      "contentHash": { "type": "keyword" },
      "crawledAt":   { "type": "date" }
    }
  }
}
```

**Search query pattern (from MCP Server):**
```json
{
  "query": {
    "multi_match": {
      "query": "...",
      "fields": ["content^3", "title^2", "siteLabel", "topic"],
      "type": "best_fields",
      "fuzziness": "AUTO"
    }
  },
  "collapse": { "field": "url.keyword" }
}
```

---

## 6. Configuration

The spiderbot reads from a YAML/JSON site configuration file:

```yaml
sites:
  - label: "IBM Docs – MAS"
    url: "https://www.ibm.com/docs/en/mas-cd"
    topic: "ibm-mas"
    selector: "main article"
    max_pages: 500
    depth: 3

  - label: "Maximo Secrets"
    url: "https://maximosecrets.com"
    topic: "community"
    selector: "article.post-content"
    max_pages: 200
    depth: 2
```

---

## 7. Incremental Crawl Logic

1. Before indexing, compute `content_hash = sha256(content)`.
2. Query OpenSearch for existing document with same `url`.
3. If `content_hash` matches → skip (unchanged page).
4. If `content_hash` differs → replace existing document.
5. If URL not found → insert new document.

---

## 8. Acceptance Criteria

| ID | Criteria |
|----|----------|
| AC-001 | `python -m spiderbot crawl` completes a full crawl of all configured sites and indexes pages to `maximo_web_knowledge` without crashing. |
| AC-002 | `--dry-run` flag prints discovered URLs without writing to OpenSearch. |
| AC-003 | `--filter "MAS CLI"` crawls only sites whose label contains "MAS CLI". |
| AC-004 | Re-running the crawl on an unchanged site skips already-indexed pages (content hash match). |
| AC-005 | Re-running with `--force` re-indexes all pages regardless of content hash. |
| AC-006 | `python -m spiderbot stats` displays the total document count and index size for `maximo_web_knowledge`. |
| AC-007 | Each indexed page document includes `url`, `title`, `siteLabel`, `topic`, `content`, and `crawledAt`. |
| AC-008 | The MCP Server's `web_knowledge_search()` returns relevant results from the crawled index for IBM Maximo documentation queries. |
| AC-009 | Pages are deduplicated by URL; running the crawl twice does not double the index size. |
