// Knowledge base utilities — load from disk, keyword search, context building

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import type { KnowledgeBase, KBPage } from "./types";

const KB_PATH = resolve(process.env.KNOWLEDGE_BASE_PATH ?? "../crawler/knowledge-base.json");

let _cached: KnowledgeBase | null = null;

export function loadKnowledgeBase(): KnowledgeBase | null {
  if (_cached) return _cached;
  if (!existsSync(KB_PATH)) return null;
  try {
    _cached = JSON.parse(readFileSync(KB_PATH, "utf8")) as KnowledgeBase;
    return _cached;
  } catch {
    return null;
  }
}

export function invalidateCache() {
  _cached = null;
}

export function getKBStatus(): {
  exists: boolean;
  built_at?: string;
  page_count?: number;
  pillars?: string[];
  stale?: boolean;
} {
  const kb = loadKnowledgeBase();
  if (!kb) return { exists: false };
  const ageMs = Date.now() - new Date(kb.meta.built_at).getTime();
  const stale = ageMs > 7 * 24 * 60 * 60 * 1000; // 7 days
  return {
    exists: true,
    built_at: kb.meta.built_at,
    page_count: kb.meta.page_count,
    pillars: kb.meta.pillars,
    stale,
  };
}

const STOP_WORDS = new Set([
  "the","a","an","and","or","but","in","on","at","to","for","of","with",
  "by","from","is","are","was","were","be","been","this","that","it","as",
  "what","how","which","who","when","where","can","does","do","will","ibm",
]);

export function scorePages(question: string, topN = 5): KBPage[] {
  const kb = loadKnowledgeBase();
  if (!kb) return [];

  const qWords = question.toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));

  if (qWords.length === 0) return kb.index.slice(0, topN).filter(p => p.text);

  const scored = kb.index
    .filter(p => p.text && !p.error)
    .map(page => {
      let score = 0;
      const pageText = (page.keywords.join(" ") + " " + page.breadcrumb + " " + (page.text ?? "")).toLowerCase();

      for (const word of qWords) {
        // Keyword list match (high weight)
        if (page.keywords.some(k => k.includes(word) || word.includes(k))) score += 5;
        // Breadcrumb match (medium weight)
        if (page.breadcrumb.toLowerCase().includes(word)) score += 3;
        // Full text match (count occurrences)
        const matches = (pageText.match(new RegExp(word, "g")) ?? []).length;
        score += Math.min(matches, 10);
      }
      return { page, score };
    })
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);

  return scored.map(s => s.page);
}

// Bob's REST API allows max 20,000 chars per message.
// Reserve ~4,000 for the prompt template + question, leaving ~16,000 for context.
const MAX_CONTEXT_CHARS = 15000;
// Per-page text cap — trim each page so we fit more pages in budget
const MAX_PAGE_CHARS = 4000;

export function buildContext(pages: KBPage[]): string {
  const sections: string[] = [];
  let totalChars = 0;

  for (const p of pages) {
    const text = (p.text ?? "").slice(0, MAX_PAGE_CHARS);
    const section = `### ${p.breadcrumb}\nSource: ${p.full_url ?? p.url}\n\n${text}`;
    if (totalChars + section.length > MAX_CONTEXT_CHARS) break;
    sections.push(section);
    totalChars += section.length;
  }

  return sections.join("\n\n---\n\n");
}
