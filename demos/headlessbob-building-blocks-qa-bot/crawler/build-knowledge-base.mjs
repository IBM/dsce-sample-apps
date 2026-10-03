/**
 * build-knowledge-base.mjs
 *
 * Crawls ALL pages from the IBM Building Blocks docs sitemap and builds
 * a structured knowledge-base.json file on disk.
 *
 * Structure:
 *   - meta:  timestamp, page count, version
 *   - tree:  hierarchical mirror of the docs site structure
 *   - index: flat array of all pages for fast keyword search
 *
 * Usage:
 *   node crawler/build-knowledge-base.mjs
 *   node crawler/build-knowledge-base.mjs --out ./data/knowledge-base.json
 *
 * On every run it does a FULL rebuild — no patching, no diffing.
 * The output file is the single source of truth.
 */

import https from "https";
import http from "http";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { dirname } from "path";

// ── Config ─────────────────────────────────────────────────────────────────
const SITEMAP_URL = "https://ibm-self-serve-assets.github.io/building-blocks-docs/sitemap.xml";
const DOCS_BASE   = "https://ibm-self-serve-assets.github.io/building-blocks-docs";
// Sitemap uses /building-blocks/ but actual pages are on /building-blocks-docs/
const SITEMAP_PATH_PREFIX = "https://ibm-self-serve-assets.github.io/building-blocks/";

const OUT_FILE    = process.argv.includes("--out")
  ? process.argv[process.argv.indexOf("--out") + 1]
  : "crawler/knowledge-base.json";

const CONCURRENCY    = 5;   // parallel page fetches
const MAX_TEXT_CHARS = 8000; // max plain text chars stored per page
const REQUEST_DELAY_MS = 150; // polite delay between fetches (ms)

// Human-readable labels for URL slugs
const SLUG_LABELS = {
  "ai-core":                      "AI Core",
  "automation-core":              "Automation Core",
  "data-core":                    "Data Core",
  "ibm-bob":                      "IBM Bob",
  "build-with-bob":               "Build with Bob",
  "workshop":                     "Workshop",
  "agents":                       "Agents",
  "engineering":                  "AI Engineering",
  "controls":                     "AI Control Plane",
  "data":                         "Data",
  "bob-skills-and-modes":         "Bob Skills & Modes",
  "agent-builder":                "Agent Builder",
  "agent-controls":               "Agent Controls",
  "agentic-sdlc":                 "Agentic SDLC",
  "multi-agent-orchestration":    "Multi-Agent Orchestration",
  "headless-bob":                 "Headless Bob",
  "code-modernization":           "Code Modernization",
  "integration-as-code":          "Integration as Code",
  "agent-ops":                    "Agent Ops",
  "ai-compliance":                "AI Compliance",
  "ai-cost-management":           "AI Cost Management",
  "lifecycle-management":         "Lifecycle Management",
  "model-evaluation":             "Model Evaluation",
  "real-time-guardrails":         "Real-Time Guardrails",
  "shadow-ai-discovery":          "Shadow AI Discovery",
  "data-ingestion":               "Data Ingestion",
  "data-security-and-encryption": "Data Security & Encryption",
  "q-and-a":                      "Q&A",
  "vector-search":                "Vector Search",
  "datastax-astra-db":            "DataStax Astra DB",
  "milvus":                       "Milvus",
  "opensearch":                   "OpenSearch",
  "zero-copy-lakehouse":          "Zero-Copy Lakehouse",
  "operate":                      "Operate",
  "configure-automate":           "Configure & Automate",
  "infrastructure-as-code":       "Infrastructure as Code",
  "workload-orchestration":       "Workload Orchestration",
  "optimize":                     "Optimize",
  "application-performance":      "Application Performance",
  "full-stack-observability":     "Full-Stack Observability",
  "network-performance":          "Network Performance",
  "technology-financial-management": "Technology Financial Management",
  "secure":                       "Secure",
  "application-risk":             "Application Risk",
  "cryptographic-readiness":      "Cryptographic Readiness",
  "non-human-identity":           "Non-Human Identity",
  "context":                      "Context",
  "context-hub":                  "Context Hub",
  "data-observability":           "Data Observability",
  "metadata-enrichment":          "Metadata Enrichment",
  "real-time-streaming":          "Real-Time Streaming",
  "pipelines":                    "Pipelines",
  "data-sync":                    "Data Sync",
  "etl":                          "ETL",
  "rag":                          "RAG",
  "text2sql":                     "Text2SQL",
  "udi":                          "UDI",
  "lakehouse":                "Query Engines",
  "serverless-vector":            "Serverless Vector",
  "extension":                    "Extension",
  "install":                      "Install",
  "skills":                       "Skills",
  "contributing_to_skills":       "Contributing to Skills",
};

function slugToLabel(slug) {
  return SLUG_LABELS[slug] ?? slug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

// ── HTTP Fetch ──────────────────────────────────────────────────────────────
function fetchUrl(url, retries = 2) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    const req = client.get(url, { headers: { "User-Agent": "bb-qa-crawler/1.0" } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const next = new URL(res.headers.location, url).href;
        return fetchUrl(next, retries).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const chunks = [];
      res.on("data", c => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      res.on("error", reject);
    });
    req.on("error", async (err) => {
      if (retries > 0) {
        await delay(500);
        fetchUrl(url, retries - 1).then(resolve, reject);
      } else {
        reject(err);
      }
    });
    req.setTimeout(15000, () => { req.destroy(); reject(new Error(`Timeout fetching ${url}`)); });
  });
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ── HTML → Plain Text ───────────────────────────────────────────────────────

/**
 * Strip a paired HTML tag and all its content (case-insensitive, handles
 * closing tags with optional whitespace before ">", e.g. </script >).
 */
function stripTag(html, tag) {
  // Matches <tag ...> ... </tag> or </tag > (whitespace before >)
  return html.replace(
    new RegExp(`<${tag}[\\s\\S]*?<\\/${tag}\\s*>`, "gi"),
    ""
  );
}

/**
 * Decode HTML entities to plain text without double-unescaping.
 * Processes &amp; last so it doesn't turn &amp;lt; into <.
 */
function decodeEntities(text) {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");   // must be last — avoids double-decode of &amp;lt; etc.
}

function htmlToText(html) {
  // Extract <title>
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].replace(/\s*[-|].*$/, "").trim() : "";

  // Extract main content area (mkdocs uses <article> or .md-content)
  let body = html;
  const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  if (articleMatch) body = articleMatch[1];
  else {
    const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
    if (mainMatch) body = mainMatch[1];
  }

  const text = decodeEntities(
    stripTag(stripTag(stripTag(stripTag(stripTag(
      body, "style"), "script"), "nav"), "header"), "footer")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s{3,}/g, "\n\n")
      .trim()
  ).slice(0, MAX_TEXT_CHARS);

  return { title, text };
}

// ── Keyword Extraction ──────────────────────────────────────────────────────
const STOP_WORDS = new Set([
  "the","a","an","and","or","but","in","on","at","to","for","of","with",
  "by","from","up","about","into","through","during","is","are","was",
  "were","be","been","being","have","has","had","do","does","did","will",
  "would","could","should","may","might","shall","can","need","this","that",
  "these","those","it","its","as","if","so","than","then","when","where",
  "which","who","how","what","ibm","building","block","blocks","building-blocks",
]);

function extractKeywords(text, path) {
  // Start with path segments as guaranteed keywords
  const fromPath = path.filter(p => p.length > 2).map(p =>
    p.replace(/-/g, " ").toLowerCase()
  );

  // Extract meaningful words from text
  const words = text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 3 && !STOP_WORDS.has(w));

  // Count frequency
  const freq = new Map();
  for (const w of words) freq.set(w, (freq.get(w) ?? 0) + 1);

  // Top 20 by frequency + path keywords
  const topWords = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([w]) => w);

  return [...new Set([...fromPath, ...topWords])].slice(0, 25);
}

// ── Parse Sitemap ───────────────────────────────────────────────────────────
function parseSitemap(xml) {
  const urls = [];
  const locRe = /<loc>(.*?)<\/loc>/g;
  let m;
  while ((m = locRe.exec(xml)) !== null) {
    const raw = m[1].trim();
    // Convert sitemap URL (/building-blocks/) → docs URL (/building-blocks-docs/)
    const url = raw.startsWith(SITEMAP_PATH_PREFIX)
      ? DOCS_BASE + "/" + raw.slice(SITEMAP_PATH_PREFIX.length)
      : raw;
    // Parse path segments
    const pathStr = raw.replace(SITEMAP_PATH_PREFIX, "").replace(/\/$/, "");
    const path = pathStr ? pathStr.split("/") : [];
    urls.push({ url, path });
  }
  return urls;
}

// ── Build Tree ──────────────────────────────────────────────────────────────
function insertIntoTree(tree, path, node) {
  if (path.length === 0) return; // root page handled separately
  let current = tree;
  for (let i = 0; i < path.length - 1; i++) {
    const seg = path[i];
    if (!current[seg]) {
      current[seg] = { label: slugToLabel(seg), children: {} };
    }
    if (!current[seg].children) current[seg].children = {};
    current = current[seg].children;
  }
  const last = path[path.length - 1];
  if (!current[last]) current[last] = {};
  // Merge node data in (preserve children if already set by a parent pass)
  Object.assign(current[last], node);
  if (!current[last].children) current[last].children = {};
}

// ── Concurrent Fetch Pool ───────────────────────────────────────────────────
async function fetchPool(items, worker, concurrency) {
  const results = new Array(items.length);
  let idx = 0;
  async function run() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await worker(items[i], i);
      await delay(REQUEST_DELAY_MS);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, run));
  return results;
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log("╔═══════════════════════════════════════════════════════╗");
  console.log("║   Building Blocks Knowledge Base Crawler              ║");
  console.log("╚═══════════════════════════════════════════════════════╝\n");

  // Step 1 — Fetch sitemap
  console.log("Step 1/4 — Fetching sitemap...");
  const sitemapXml = await fetchUrl(SITEMAP_URL);
  const pages = parseSitemap(sitemapXml);
  console.log(`✅ Found ${pages.length} pages in sitemap\n`);

  // Step 2 — Fetch & parse all pages
  console.log(`Step 2/4 — Crawling ${pages.length} pages (${CONCURRENCY} parallel)...`);
  let done = 0;
  const crawled = await fetchPool(pages, async ({ url, path }) => {
    try {
      const html = await fetchUrl(url);
      const { title, text } = htmlToText(html);
      const keywords = extractKeywords(text, path);
      const label = title || slugToLabel(path[path.length - 1] ?? "Home");
      done++;
      process.stdout.write(`\r  ✅ ${done}/${pages.length} pages crawled`);
      return { url, path, label, keywords, text, ok: true };
    } catch (err) {
      done++;
      process.stdout.write(`\r  ⚠️  ${done}/${pages.length} — failed: ${url}`);
      return { url, path, label: slugToLabel(path[path.length - 1] ?? ""), keywords: [], text: "", ok: false, error: err.message };
    }
  }, CONCURRENCY);
  console.log(`\n✅ Crawling complete (${crawled.filter(c => c.ok).length} succeeded, ${crawled.filter(c => !c.ok).length} failed)\n`);

  // Step 3 — Build tree + index
  console.log("Step 3/4 — Building hierarchical tree and flat index...");
  const tree = {};
  const index = [];

  for (const page of crawled) {
    const { url, path, label, keywords, text, ok, error } = page;
    const breadcrumb = path.map(slugToLabel).join(" > ") || "Home";
    const relativePath = "/" + (url.replace(DOCS_BASE, "").replace(/^\//, ""));

    // Index entry — every page regardless of depth
    const indexEntry = {
      path,
      breadcrumb,
      url: relativePath,
      full_url: url,
      label,
      keywords,
      depth: path.length,
    };
    if (ok) indexEntry.text = text;
    if (!ok) indexEntry.error = error;
    index.push(indexEntry);

    // Tree entry
    const treeNode = {
      label,
      url: relativePath,
      breadcrumb,
      keywords,
    };
    if (ok) treeNode.text = text;
    if (!ok) treeNode.error = error;

    insertIntoTree(tree, path, treeNode);
  }

  // Sort index by path depth then alphabetically for readability
  index.sort((a, b) => {
    if (a.depth !== b.depth) return a.depth - b.depth;
    return a.breadcrumb.localeCompare(b.breadcrumb);
  });

  console.log(`✅ Tree built with ${Object.keys(tree).length} top-level pillars`);
  console.log(`✅ Index built with ${index.length} entries\n`);

  // Step 4 — Write to disk
  console.log(`Step 4/4 — Writing knowledge base to ${OUT_FILE}...`);
  const knowledgeBase = {
    meta: {
      built_at: new Date().toISOString(),
      page_count: crawled.filter(c => c.ok).length,
      total_urls: pages.length,
      docs_base: DOCS_BASE,
      version: 1,
      pillars: Object.keys(tree),
    },
    tree,
    index,
  };

  const outDir = dirname(OUT_FILE);
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  writeFileSync(OUT_FILE, JSON.stringify(knowledgeBase, null, 2), "utf8");

  const fileSizeKB = Math.round(
    Buffer.byteLength(JSON.stringify(knowledgeBase)) / 1024
  );

  console.log(`✅ Written: ${OUT_FILE} (${fileSizeKB} KB)\n`);

  // Summary
  console.log("╔═══════════════════════════════════════════════════════╗");
  console.log("║   Knowledge Base Summary                              ║");
  console.log("╠═══════════════════════════════════════════════════════╣");
  console.log(`║  Built at   : ${knowledgeBase.meta.built_at.slice(0,19).replace("T"," ")}              ║`);
  console.log(`║  Pages OK   : ${String(knowledgeBase.meta.page_count).padEnd(4)} / ${pages.length} total                     ║`);
  console.log(`║  File size  : ${String(fileSizeKB).padEnd(6)} KB                              ║`);
  console.log(`║  Top pillars: ${knowledgeBase.meta.pillars.join(", ").slice(0, 38).padEnd(38)} ║`);
  console.log("╠═══════════════════════════════════════════════════════╣");
  console.log("║  Tree structure:                                      ║");
  for (const [pillar, node] of Object.entries(tree)) {
    const childCount = Object.keys(node.children ?? {}).length;
    console.log(`║    📁 ${(node.label ?? pillar).padEnd(28)} (${String(childCount).padStart(2)} sections)  ║`);
    for (const [section, sNode] of Object.entries(node.children ?? {})) {
      const leafCount = Object.keys(sNode.children ?? {}).length;
      console.log(`║       📂 ${(sNode.label ?? section).padEnd(25)} (${String(leafCount).padStart(2)} pages)     ║`);
    }
  }
  console.log("╚═══════════════════════════════════════════════════════╝\n");
}

main().catch(err => {
  console.error("\n❌ Fatal error:", err.message);
  process.exit(1);
});
