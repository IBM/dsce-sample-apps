// Types shared across the app

export interface KBMeta {
  built_at: string;
  page_count: number;
  total_urls: number;
  docs_base: string;
  version: number;
  pillars: string[];
}

export interface KBPage {
  path: string[];
  breadcrumb: string;
  url: string;
  full_url: string;
  label: string;
  keywords: string[];
  depth: number;
  text?: string;
  error?: string;
}

export interface KnowledgeBase {
  meta: KBMeta;
  tree: Record<string, unknown>;
  index: KBPage[];
}

export interface Thread {
  id: string;
  title: string;
  session_id: string | null;
  last_run_id: string | null;
  archived: boolean;
  created_at: string;
  updated_at: string;
  status: string;
}

export interface Message {
  role: string;
  content: string;
  sources?: { breadcrumb: string; url: string }[];
  created_at?: string;
}

export interface ChatTurn {
  id: string;
  user: string;
  assistant: string;
  sources: { breadcrumb: string; url: string }[];
  created_at: string;
}
