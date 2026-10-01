"use client";

import { useEffect, useState, useCallback } from "react";

interface KBStatus {
  exists: boolean;
  built_at?: string;
  page_count?: number;
  pillars?: string[];
  stale?: boolean;
}

interface Thread {
  id: string;
  title: string;
  updated_at: string;
  status: string;
}

interface SidebarProps {
  activeThreadId: string | null;
  onSelectThread: (id: string, title: string) => void;
  onNewChat: () => void;
  onKBReady: (ready: boolean) => void;
  newThreadSignal?: { id: string; title: string } | null;
  onRefreshKB: () => void;
  isRefreshing: boolean;
  crawlLog: string;
}

export default function Sidebar({
  activeThreadId,
  onSelectThread,
  onNewChat,
  onKBReady,
  newThreadSignal,
  onRefreshKB,
  isRefreshing,
  crawlLog,
}: SidebarProps) {
  const [kbStatus, setKbStatus] = useState<KBStatus>({ exists: false });
  const [threads, setThreads]   = useState<Thread[]>([]);
  const [search, setSearch]     = useState("");
  const [tab, setTab]           = useState<"active" | "archived">("active");

  const fetchKBStatus = useCallback(async () => {
    try {
      const res  = await fetch("/api/kb-status");
      const data = await res.json();
      setKbStatus(data);
      onKBReady(data.exists);
    } catch { /* ignore */ }
  }, [onKBReady]);

  const fetchThreads = useCallback(async () => {
    try {
      const res  = await fetch("/api/threads");
      const data = await res.json();
      setThreads(data.threads ?? []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchKBStatus();
    fetchThreads();
  }, [fetchKBStatus, fetchThreads]);

  // Re-fetch KB status after crawl finishes
  useEffect(() => {
    if (!isRefreshing) fetchKBStatus();
  }, [isRefreshing, fetchKBStatus]);

  useEffect(() => {
    if (newThreadSignal) {
      setThreads(prev => {
        if (prev.find(t => t.id === newThreadSignal.id)) return prev;
        return [
          { id: newThreadSignal.id, title: newThreadSignal.title, updated_at: new Date().toISOString(), status: "ready" },
          ...prev,
        ];
      });
    }
  }, [newThreadSignal]);

  async function deleteThread(id: string) {
    await fetch(`/api/threads?id=${id}`, { method: "DELETE" });
    setThreads(prev => prev.filter(t => t.id !== id));
    if (activeThreadId === id) onNewChat();
  }

  async function deleteAllThreads() {
    if (!confirm("Delete all conversations? This cannot be undone.")) return;
    await fetch("/api/threads?all=1", { method: "DELETE" });
    setThreads([]);
    onNewChat();
  }

  function formatDate(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  function groupByDate(list: Thread[]) {
    const groups: Record<string, Thread[]> = {};
    const now = new Date();
    for (const t of list) {
      const d     = new Date(t.updated_at);
      const diffD = Math.floor((now.getTime() - d.getTime()) / 86400000);
      const label = diffD === 0 ? "Today" : diffD === 1 ? "Yesterday" : diffD < 7 ? "This week" : "Older";
      if (!groups[label]) groups[label] = [];
      groups[label].push(t);
    }
    return groups;
  }

  const filtered = threads.filter(
    t => !search || t.title.toLowerCase().includes(search.toLowerCase())
  );
  const grouped = groupByDate(filtered);
  const ORDER   = ["Today", "Yesterday", "This week", "Older"];

  return (
    <div className="flex flex-col h-full" style={{ background: "#1c2b1c", color: "#e8f0e8" }}>

      {/* ── Logo ─────────────────────────────────────────── */}
      <div className="px-4 pt-5 pb-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="flex items-center gap-2.5">
          <img
            src="/logo.png"
            alt="Building Blocks Q&A"
            className="w-9 h-9 rounded-xl flex-shrink-0 object-cover"
          />
          <div>
            <p className="font-semibold text-sm leading-tight" style={{ color: "#e8f0e8" }}>Building Blocks Q&amp;A</p>
            <p className="text-[10px] uppercase tracking-widest font-medium mt-0.5" style={{ color: "#6a8f6a" }}>
              Powered by Headless Bob
            </p>
          </div>
        </div>
      </div>

      {/* ── New thread ───────────────────────────────────── */}
      <div className="px-3 py-3">
        <button
          onClick={onNewChat}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all"
          style={{ background: "#3a6b3a", color: "#e8f0e8" }}
          onMouseEnter={e => (e.currentTarget.style.background = "#4a7b4a")}
          onMouseLeave={e => (e.currentTarget.style.background = "#3a6b3a")}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          New thread
        </button>
      </div>

      {/* ── Search ───────────────────────────────────────── */}
      <div className="px-3 pb-2">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search threads..."
          className="w-full px-3 py-1.5 text-xs rounded-md focus:outline-none transition-colors"
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "#c8dcc8",
          }}
        />
      </div>

      {/* ── Active / Archived tabs ────────────────────────── */}
      <div className="flex gap-1 px-3 pb-3">
        {(["active", "archived"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex-1 py-1 text-xs font-medium rounded-md transition-all capitalize"
            style={
              tab === t
                ? { background: "rgba(255,255,255,0.12)", color: "#e8f0e8" }
                : { color: "#6a8f6a" }
            }
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* ── Thread list ───────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {threads.length > 0 && (
          <button
            onClick={deleteAllThreads}
            className="w-full text-left px-2 py-1 text-[10px] transition-colors flex items-center gap-1.5 mb-1"
            style={{ color: "#5a7a5a" }}
            onMouseEnter={e => (e.currentTarget.style.color = "#e07070")}
            onMouseLeave={e => (e.currentTarget.style.color = "#5a7a5a")}
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Clear all
          </button>
        )}

        {filtered.length === 0 && (
          <p className="text-xs text-center py-6" style={{ color: "#5a7a5a" }}>
            {search ? "No matching threads" : "No conversations yet"}
          </p>
        )}

        {ORDER.filter(l => grouped[l]).map(label => (
          <div key={label} className="mb-3">
            <p
              className="text-[10px] font-semibold uppercase tracking-wider px-2 mb-1"
              style={{ color: "#4a6a4a" }}
            >
              {label}
            </p>
            {grouped[label].map(thread => (
              <div
                key={thread.id}
                data-thread-id={thread.id}
                data-thread-title={thread.title}
                onClick={() => onSelectThread(thread.id, thread.title)}
                className="group flex items-center justify-between px-2 py-2 rounded-lg cursor-pointer mb-0.5 transition-colors"
                style={
                  activeThreadId === thread.id
                    ? { background: "rgba(255,255,255,0.1)", color: "#e8f0e8" }
                    : { color: "#8aaa8a" }
                }
                onMouseEnter={e => {
                  if (activeThreadId !== thread.id)
                    e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                }}
                onMouseLeave={e => {
                  if (activeThreadId !== thread.id)
                    e.currentTarget.style.background = "transparent";
                }}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{thread.title || "Untitled"}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: "#4a6a4a" }}>
                    {formatDate(thread.updated_at)}
                  </p>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); deleteThread(thread.id); }}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded transition-all flex-shrink-0"
                  style={{ color: "#5a7a5a" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "#e07070")}
                  onMouseLeave={e => (e.currentTarget.style.color = "#5a7a5a")}
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* ── Footer links ──────────────────────────────────── */}
      <div className="px-3 py-3" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
        {/* KB status row */}
        <div className="flex items-center justify-between mb-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <div
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ background: kbStatus.exists ? "#5cb85c" : "#e6a817" }}
              />
              <span className="text-[11px] font-medium truncate" style={{ color: "#8aaa8a" }}>
                {kbStatus.exists ? `${kbStatus.page_count} pages indexed` : "KB not built"}
              </span>
            </div>
            {kbStatus.exists && kbStatus.built_at && (
              <p className="text-[10px] mt-0.5 pl-3" style={{ color: "#4a6a4a" }}>
                {new Date(kbStatus.built_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              </p>
            )}
            {crawlLog && (
              <p className="text-[10px] mt-0.5 pl-3 italic truncate" style={{ color: "#5a7a5a" }}>
                {crawlLog}
              </p>
            )}
          </div>
          <button
            onClick={onRefreshKB}
            disabled={isRefreshing}
            title="Bob will crawl all docs and rebuild the knowledge base"
            className="ml-2 p-1.5 rounded-md transition-colors flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ color: "#6a8f6a" }}
            onMouseEnter={e => (e.currentTarget.style.color = "#a8d5a8")}
            onMouseLeave={e => (e.currentTarget.style.color = "#6a8f6a")}
          >
            <svg className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>

        {/* Owner / disconnect row */}
        <div className="flex items-center justify-between mt-2 pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
          <span className="text-[11px] font-medium" style={{ color: "#5a7a5a" }}>owner</span>
          <button className="text-[11px] transition-colors" style={{ color: "#5a7a5a" }}>
            Disconnect
          </button>
        </div>
      </div>
    </div>
  );
}
