"""Web crawler — Playwright-based BFS crawler for a single SiteEntry.

Design decisions:
- One ``PageCrawler`` instance per site (a new Playwright browser per site).
- BFS traversal respects ``max_depth`` and ``max_pages`` limits.
- Noise elements (nav, header, footer, scripts) are removed before text extraction.
- All links are normalised (fragment stripped, trailing slash removed).
"""

from __future__ import annotations

import re
from typing import Callable, Awaitable
from dataclasses import dataclass

from playwright.sync_api import sync_playwright, Browser, BrowserContext, Page

from spiderbot.src.config import spiderbot as cfg
from spiderbot.src.crawler.site_registry import SiteEntry
from shared.logging import get_logger

logger = get_logger(__name__)

_NOISE_SELECTORS = [
    "nav", "header", "footer", "script", "style", "noscript",
    '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]',
    ".sidebar", ".toc", ".breadcrumb", ".cookie-banner",
    "#cookie-consent", "#header", "#footer", "#sidebar",
]

_BINARY_EXT_RE = re.compile(
    r"\.(pdf|zip|tar|gz|png|jpg|jpeg|gif|svg|ico|css|js|woff2?|ttf|eot)$",
    re.IGNORECASE,
)


@dataclass
class CrawledPage:
    """Data extracted from a single crawled page."""

    url: str
    title: str
    text: str
    html: str
    depth: int
    crawled_at: str
    site_label: str
    topic: str


def _scroll_to_bottom(page: Page) -> None:
    """Scroll the page from top to bottom to trigger lazy-loaded content."""
    page.evaluate(
        """(delay) => new Promise(resolve => {
            let scrolled = 0;
            const step = window.innerHeight;
            const max = document.body.scrollHeight;
            const t = setInterval(() => {
                window.scrollBy(0, step);
                scrolled += step;
                if (scrolled >= max) { clearInterval(t); resolve(); }
            }, delay);
        })""",
        cfg.scroll_delay_ms,
    )
    page.evaluate("() => window.scrollTo(0, 0)")


def _extract_text(page: Page) -> tuple[str, str, str]:
    """Remove noise, then extract title, plain text, and inner HTML."""
    return page.evaluate(
        """() => {
            const noisy = %s;
            noisy.forEach(sel => document.querySelectorAll(sel).forEach(el => el.remove()));
            const root = document.querySelector('main')
                      || document.querySelector('article')
                      || document.querySelector('[role="main"]')
                      || document.body;
            const html = root.innerHTML || '';
            const raw = root.innerText || root.textContent || '';
            const text = raw.split('\\n')
                           .map(l => l.trim())
                           .filter(l => l.length > 0)
                           .join('\\n');
            return [document.title || '', text, html];
        }"""
        % str(_NOISE_SELECTORS)
    )


def _extract_links(page: Page, site: SiteEntry, visited: set[str]) -> list[str]:
    """Return unvisited, same-origin links that pass the site's allow rules."""
    page_url = page.url
    origin = "/".join(page_url.split("/")[:3])  # scheme + host

    hrefs: list[str] = page.evaluate(
        "() => Array.from(document.querySelectorAll('a[href]')).map(a => a.href)"
    )

    links: list[str] = []
    for href in hrefs:
        if not href.startswith(origin):
            continue
        # Normalise: strip fragment and trailing slash
        norm = href.split("#")[0].rstrip("/")
        if norm in visited:
            continue
        if any(pat in norm for pat in site.block_patterns):
            continue
        if site.allowed_path_prefixes:
            path = norm[len(origin):]  # pathname
            if not any(path.startswith(pfx) for pfx in site.allowed_path_prefixes):
                continue
        if _BINARY_EXT_RE.search(norm.split("?")[0]):
            continue
        links.append(norm)

    return list(dict.fromkeys(links))  # de-duplicate, preserve order


class PageCrawler:
    """Synchronous BFS crawler backed by Playwright.

    Usage::

        from spiderbot.src.crawler.page_crawler import PageCrawler, CrawledPage

        crawler = PageCrawler()
        crawler.init()
        crawler.crawl_site(site_entry, on_page=my_callback)
        crawler.close()

    ``on_page`` is called with each successfully crawled :class:`CrawledPage`.
    """

    def __init__(self) -> None:
        self._playwright = None
        self._browser: Browser | None = None

    def init(self) -> None:
        """Launch the Playwright browser. Must be called before :meth:`crawl_site`."""
        self._playwright = sync_playwright().start()
        self._browser = self._playwright.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
        )
        logger.info("Playwright browser launched")

    def close(self) -> None:
        """Shut down the browser and Playwright runtime."""
        if self._browser:
            self._browser.close()
            self._browser = None
        if self._playwright:
            self._playwright.stop()
            self._playwright = None
        logger.info("Playwright browser closed")

    def crawl_site(
        self,
        site: SiteEntry,
        on_page: Callable[[CrawledPage], None],
        dry_run: bool = False,
    ) -> None:
        """Crawl *site* with BFS and call *on_page* for every page extracted.

        Args:
            site:     Site definition from the registry.
            on_page:  Callback called with each :class:`CrawledPage`.
            dry_run:  Log URLs that would be crawled without fetching them.
        """
        if not self._browser:
            raise RuntimeError("Browser not initialised — call init() first")

        max_depth = site.max_depth if site.max_depth is not None else cfg.max_depth
        max_pages = site.max_pages if site.max_pages is not None else cfg.max_pages_per_site

        visited: set[str] = set()
        queue: list[tuple[str, int]] = [(site.seed_url, 0)]
        page_count = 0

        logger.info(
            "Crawl started",
            extra={"label": site.label, "seed": site.seed_url, "max_depth": max_depth},
        )

        context: BrowserContext = self._browser.new_context(
            user_agent="Mozilla/5.0 (compatible; MaximoSpiderbot/1.0)",
            ignore_https_errors=True,
        )
        try:
            while queue and (max_pages == 0 or page_count < max_pages):
                url, depth = queue.pop(0)
                norm = url.rstrip("/")
                if norm in visited:
                    continue
                visited.add(norm)

                if dry_run:
                    logger.info("[DRY RUN] Would crawl", extra={"url": url, "depth": depth})
                    page_count += 1
                    continue

                pw_page: Page = context.new_page()
                try:
                    pw_page.goto(
                        url,
                        wait_until="domcontentloaded",
                        timeout=cfg.page_load_timeout_ms,
                    )
                    pw_page.wait_for_timeout(500)
                    _scroll_to_bottom(pw_page)

                    title, text, html = _extract_text(pw_page)
                    from datetime import datetime, timezone

                    crawled = CrawledPage(
                        url=pw_page.url,
                        title=title,
                        text=text,
                        html=html,
                        depth=depth,
                        crawled_at=datetime.now(timezone.utc).isoformat(),
                        site_label=site.label,
                        topic=site.topic,
                    )
                    on_page(crawled)
                    page_count += 1
                    logger.info("Crawled", extra={"url": url, "chars": len(text)})

                    if depth < max_depth:
                        links = _extract_links(pw_page, site, visited)
                        queue.extend((lnk, depth + 1) for lnk in links)

                except Exception as exc:
                    logger.warning("Page crawl failed", extra={"url": url, "error": str(exc)})
                finally:
                    pw_page.close()

        finally:
            context.close()

        logger.info("Site crawl complete", extra={"label": site.label, "pages": page_count})
