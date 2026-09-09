"""Site registry — all seed URLs and per-site crawl rules.

Each entry defines a starting URL and the rules that govern how far the
crawler follows links from that seed. Keep this file as the single source
of truth for which sites belong to the Maximo web-knowledge corpus.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class SiteEntry:
    """A single site to crawl.

    Attributes:
        seed_url:              URL to start crawling from.
        label:                 Human-readable label stored in OpenSearch metadata.
        topic:                 Topic tag (e.g. ``"cli"``, ``"performance"``).
        allowed_path_prefixes: Only follow links whose path starts with one of
                               these prefixes. An empty list means *all* paths
                               on the same origin are allowed.
        block_patterns:        Any link whose URL contains one of these strings
                               is skipped.
        max_depth:             Per-site override for maximum crawl depth.
        max_pages:             Per-site override for maximum pages to crawl.
    """

    seed_url: str
    label: str
    topic: str
    allowed_path_prefixes: list[str] = field(default_factory=list)
    block_patterns: list[str] = field(default_factory=list)
    max_depth: Optional[int] = None
    max_pages: Optional[int] = None


#: All sites included in the Maximo web-knowledge corpus.
SITES: list[SiteEntry] = [
    SiteEntry(
        seed_url="https://ibm-maximo-dev.github.io/configuration-practices-documentation/overview",
        label="Maximo Configuration Practices",
        topic="configuration",
        allowed_path_prefixes=["/configuration-practices-documentation/"],
    ),
    SiteEntry(
        seed_url=(
            "https://community.ibm.com/community/user/groups/community-home/"
            "recent-community-blogs?CommunityKey=3d7261ae-48f7-481d-b675-a40eb407e0fd"
        ),
        label="IBM Community – Maximo Blogs",
        topic="community",
        allowed_path_prefixes=["/community/user/groups/community-home/"],
        block_patterns=["/login", "/register", "/sign-in", "javascript:", "#", "/events", "/members"],
        max_depth=2,
        max_pages=80,
    ),
    SiteEntry(
        seed_url="https://ibm-mas.github.io/mas-performance/",
        label="MAS Performance Guide",
        topic="performance",
        allowed_path_prefixes=["/mas-performance/"],
    ),
    SiteEntry(
        seed_url="https://www.ibm.com/docs/en/masv-and-l/maximo-manage/cd?topic=configuring-maximo-mobile",
        label="IBM Docs – Maximo Mobile Configuration",
        topic="mobile",
        allowed_path_prefixes=["/docs/en/masv-and-l/maximo-manage/"],
        block_patterns=["/api/", "/feedback", "/login", "mailto:"],
        max_pages=60,
    ),
    SiteEntry(
        seed_url="https://ibm-mas.github.io/cli/",
        label="MAS CLI Documentation",
        topic="cli",
        allowed_path_prefixes=["/cli/"],
    ),
    SiteEntry(
        seed_url="https://ibm-mas.github.io/ansible-devops/",
        label="MAS Ansible DevOps",
        topic="devops",
        allowed_path_prefixes=["/ansible-devops/"],
    ),
    SiteEntry(
        seed_url="https://ibm-mas.github.io/python-devops/",
        label="MAS Python DevOps",
        topic="devops",
        allowed_path_prefixes=["/python-devops/"],
    ),
    SiteEntry(
        seed_url="https://www.ibm.com/docs/en/masv-and-l/cd?topic=a-maximo-real-estate-facilities",
        label="IBM Docs – Maximo Real Estate & Facilities",
        topic="real-estate-facilities",
        allowed_path_prefixes=["/docs/en/masv-and-l/"],
        block_patterns=["/api/", "/feedback", "/login", "mailto:"],
        max_pages=60,
    ),
    SiteEntry(
        seed_url="https://ibm-mas.github.io/mcpi/",
        label="MAS MCPI Documentation",
        topic="mcpi",
        allowed_path_prefixes=["/mcpi/"],
    ),
    SiteEntry(
        seed_url="https://www.ibm.com/docs/en/mas",
        label="IBM Docs – MAS",
        topic="mas-docs",
        allowed_path_prefixes=["/docs/en/mas"],
        block_patterns=["/api/", "/feedback", "/login", "mailto:"],
        max_depth=2,
        max_pages=120,
    ),
    SiteEntry(
        seed_url="https://maximosecrets.com/",
        label="Maximo Secrets",
        topic="tips-tricks",
        allowed_path_prefixes=["/"],
        block_patterns=["/wp-login", "/wp-admin", "/feed", "mailto:", "/tag/", "/author/", "/page/"],
        max_depth=3,
        max_pages=150,
    ),
]
