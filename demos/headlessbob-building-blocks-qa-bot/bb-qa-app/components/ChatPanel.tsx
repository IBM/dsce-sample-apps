"use client";

import { useState, useRef, useEffect } from "react";
import { marked, Renderer } from "marked";

// Prevent XSS: disable raw HTML pass-through in marked output.
// The renderer escapes any literal HTML that appears inside Markdown so that
// only the Markdown-rendered output is ever injected into the DOM.
const safeRenderer = new Renderer();
safeRenderer.html = ({ text }: { text: string }) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
marked.use({ renderer: safeRenderer });

interface Source  { breadcrumb: string; url: string }
interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  isStreaming?: boolean;
  usage?: { session_costs?: number; duration_ms?: number };
}

interface ChatPanelProps {
  threadId: string | null;
  threadTitle: string | null;
  onThreadCreated: (id: string, title: string) => void;
  kbReady: boolean;
}

const SUGGESTIONS = [
  "What building blocks are available for building AI agents?",
  "What is the AI Control Plane and how does it govern AI systems?",
  "How do the Data building blocks support ingestion and pipelines?",
  "What automation capabilities do the Automation building blocks provide?",
];

export default function ChatPanel({ threadId, threadTitle, onThreadCreated, kbReady }: ChatPanelProps) {
  const [messages, setMessages]     = useState<Message[]>([]);
  const [input, setInput]           = useState("");
  const [isLoading, setIsLoading]   = useState(false);
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(threadId);
  const [charCount, setCharCount]   = useState(0);
  const [runStatus, setRunStatus]   = useState<"idle" | "running" | "completed" | "error">("idle");

  const bottomRef          = useRef<HTMLDivElement>(null);
  const textareaRef        = useRef<HTMLTextAreaElement>(null);
  const abortRef           = useRef<AbortController | null>(null);
  const isStreamingRef     = useRef(false);
  // Ref mirror of currentThreadId — always readable without stale closure issues
  const currentThreadIdRef = useRef<string | null>(threadId);
  // Flag: true when the threadId prop change came from our own sendMessage (not user nav)
  const ownThreadChangeRef = useRef(false);

  // Keep ref in sync whenever state changes
  useEffect(() => { currentThreadIdRef.current = currentThreadId; }, [currentThreadId]);

  useEffect(() => {
    // If this threadId change was triggered by our own sendMessage creating a new thread,
    // skip — we're mid-stream and don't want to clear messages or abort.
    if (ownThreadChangeRef.current) {
      ownThreadChangeRef.current = false;
      return;
    }
    // User navigated to a different thread — cancel any in-flight stream and load history.
    if (isStreamingRef.current) {
      abortRef.current?.abort();
      isStreamingRef.current = false;
      setIsLoading(false);
    }
    setCurrentThreadId(threadId);
    currentThreadIdRef.current = threadId;
    setMessages([]);
    setRunStatus("idle");
    if (threadId) loadHistory(threadId);
  }, [threadId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadHistory(tid: string) {
    try {
      const res  = await fetch(`/api/threads/${tid}/messages`);
      const data = await res.json();
      const msgs: Message[] = [];
      for (const turn of data.turns ?? []) {
        if (turn.user_message)      msgs.push({ id: `u-${turn.id}`, role: "user",      content: turn.user_message });
        if (turn.assistant_message) msgs.push({ id: `a-${turn.id}`, role: "assistant", content: turn.assistant_message, usage: turn.usage as any });
      }
      setMessages(msgs);
      if (msgs.length > 0) setRunStatus("completed");
    } catch { setMessages([]); }
  }

  async function sendMessage() {
    const q = input.trim();
    if (!q || isLoading || !kbReady) return;

    setInput(""); setCharCount(0);
    setIsLoading(true);
    setRunStatus("running");
    isStreamingRef.current = true;

    const userMsgId      = `u-${Date.now()}`;
    const assistantMsgId = `a-${Date.now()}`;

    setMessages(prev => [
      ...prev,
      { id: userMsgId,      role: "user",     content: q },
      { id: assistantMsgId, role: "assistant", content: "", isStreaming: true },
    ]);

    try {
      const chatRes = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Use the ref (not state) so we always get the latest threadId even in stale closures
        body: JSON.stringify({ question: q, threadId: currentThreadIdRef.current, threadTitle: q.slice(0, 60) }),
      });
      if (!chatRes.ok) { const e = await chatRes.json(); throw new Error(e.error ?? "Chat request failed"); }

      const { threadId: newThreadId, runId, sources, isNewThread } = await chatRes.json();
      if (isNewThread && newThreadId) {
        // Mark that this threadId prop change is ours — don't let the useEffect clear messages
        ownThreadChangeRef.current = true;
        setCurrentThreadId(newThreadId);
        currentThreadIdRef.current = newThreadId; // update ref immediately — don't wait for state flush
        onThreadCreated(newThreadId, q.slice(0, 60));
      }
      setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, sources } : m));

      const ctrl   = new AbortController();
      abortRef.current = ctrl;
      const stream = await fetch(`/api/stream?runId=${runId}`, { signal: ctrl.signal });
      const reader = stream.body!.getReader();
      const dec    = new TextDecoder();
      let buf = "", full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n"); buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim(); if (!raw) continue;
          try {
            const ev = JSON.parse(raw);
            if (ev.type === "chunk") {
              full += ev.text;
              setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, content: full, isStreaming: true } : m));
            } else if (ev.type === "done") {
              setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, content: full, isStreaming: false, usage: ev.usage } : m));
              setRunStatus("completed");
            } else if (ev.type === "error") {
              setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, content: `Error: ${ev.message}`, isStreaming: false } : m));
              setRunStatus("error");
            }
          } catch { /* skip */ }
        }
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setMessages(prev => prev.map(m => m.id === `a-${Date.now()}` ? { ...m, content: `Error: ${err.message}`, isStreaming: false } : m));
        setRunStatus("error");
      }
    } finally {
      isStreamingRef.current = false;
      setIsLoading(false);
      abortRef.current = null;
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  function renderMarkdown(text: string): string {
    try { return marked.parse(text) as string; } catch { return text; }
  }

  const currentTitle = threadTitle
    ?? (messages.length > 0 ? messages[0].content.slice(0, 60) : null);
  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-full bg-white">

      {/* ── Top bar ───────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-6 py-3 flex-shrink-0"
        style={{ borderBottom: "1px solid #e5e7eb" }}
      >
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-widest" style={{ color: "#9ca3af" }}>
            KNOWLEDGE BASE / THREADS
          </p>
          <p className="text-[15px] font-semibold mt-0.5 truncate max-w-lg" style={{ color: "#111827" }}>
            {currentTitle ?? "New thread"}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1 flex-shrink-0 ml-4">
          {[
            { label: "Refresh", icon: (
              <svg className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
              </svg>
            ), onClick: () => { if (threadId) loadHistory(threadId); } },
          ].map(btn => (
            <button
              key={btn.label}
              onClick={btn.onClick}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded transition-colors"
              style={{ color: "#374151", border: "1px solid #e5e7eb" }}
              onMouseEnter={e => { e.currentTarget.style.background = "#f9fafb"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
            >
              {btn.icon}
              {btn.label}
            </button>
          ))}
          <a
            href="https://ibm-self-serve-assets.github.io/building-blocks-docs/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded transition-colors"
            style={{ color: "#374151", border: "1px solid #e5e7eb" }}
            onMouseEnter={e => { e.currentTarget.style.background = "#f9fafb"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
          >
            BB Docs
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
            </svg>
          </a>

          {/* KB status badge */}
          <span
            className="text-[10px] px-2 py-1 rounded font-semibold uppercase tracking-wider ml-1"
            style={kbReady
              ? { background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0" }
              : { background: "#fefce8", color: "#ca8a04", border: "1px solid #fde68a" }
            }
          >
            {kbReady ? "KB Ready" : "KB Needed"}
          </span>
        </div>
      </div>

      {/* ── Messages ──────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {isEmpty ? (
          /* ── Empty state ── */
          <div className="flex flex-col items-center justify-center h-full text-center px-6 py-12">
            <img
              src="/logo.png"
              alt="Building Blocks Q&A"
              className="w-20 h-20 rounded-2xl mb-5 object-cover"
            />
            <h2 className="text-xl font-semibold mb-2" style={{ color: "#111827" }}>
              IBM Building Blocks Q&amp;A
            </h2>
            <p className="text-sm mb-8 max-w-sm" style={{ color: "#6b7280" }}>
              Ask anything about the Building Blocks — agents, data pipelines, automation, AI trust, and more.
            </p>

            {!kbReady && (
              <div
                className="mb-8 px-4 py-3 rounded-lg text-sm max-w-sm"
                style={{ background: "#fefce8", border: "1px solid #fde68a", color: "#854d0e" }}
              >
                Knowledge base not built yet. Click the refresh icon in the sidebar to let Bob crawl the docs.
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-xl">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => { setInput(s); setCharCount(s.length); textareaRef.current?.focus(); }}
                  className="text-left px-4 py-3.5 rounded-xl text-sm transition-all"
                  style={{
                    border: "1px solid #e5e7eb",
                    background: "#ffffff",
                    color: "#374151",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = "#f9fafb"; e.currentTarget.style.borderColor = "#d1d5db"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "#ffffff"; e.currentTarget.style.borderColor = "#e5e7eb"; }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* ── Message list ── */
          <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">
            {messages.map(msg => (
              <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>

                {msg.role === "assistant" && (
                  <img
                    src="/logo.png"
                    alt="BB"
                    className="w-7 h-7 rounded-lg flex-shrink-0 mt-0.5 object-cover"
                  />
                )}

                <div className={`max-w-2xl space-y-2 flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
                  <div
                    className="rounded-2xl px-4 py-3 text-sm"
                    style={msg.role === "user"
                      ? { background: "#1c2b1c", color: "#e8f0e8", borderRadius: "18px 18px 4px 18px" }
                      : { background: "#f9fafb", border: "1px solid #e5e7eb", color: "#111827", borderRadius: "4px 18px 18px 18px" }
                    }
                  >
                    {msg.role === "user" ? (
                      <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    ) : (
                      <div>
                        {msg.content ? (
                          <div
                            className="prose max-w-none"
                            dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                          />
                        ) : (
                          <span className="text-sm" style={{ color: "#9ca3af" }}>Thinking…</span>
                        )}
                        {msg.isStreaming && (
                          <span className="inline-block w-2 h-4 bg-gray-400 cursor-blink ml-0.5 rounded-sm align-middle" />
                        )}
                      </div>
                    )}
                  </div>

                  {/* Sources */}
                  {msg.role === "assistant" && !msg.isStreaming && msg.sources && msg.sources.length > 0 && (
                    <div className="px-1">
                      <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#9ca3af" }}>
                        Sources
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {msg.sources.map((src, i) => (
                          <a
                            key={i}
                            href={src.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] px-2.5 py-1 rounded-full transition-colors"
                            style={{ border: "1px solid #e5e7eb", background: "#ffffff", color: "#6b7280" }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = "#9ca3af"; e.currentTarget.style.color = "#374151"; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = "#e5e7eb"; e.currentTarget.style.color = "#6b7280"; }}
                          >
                            {src.breadcrumb}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Usage */}
                  {msg.role === "assistant" && !msg.isStreaming && msg.usage && (
                    <p className="text-[10px] px-1" style={{ color: "#9ca3af" }}>
                      {msg.usage.session_costs != null && `$${msg.usage.session_costs.toFixed(4)} · `}
                      {msg.usage.duration_ms != null && `${msg.usage.duration_ms}ms`}
                    </p>
                  )}
                </div>

                {msg.role === "user" && (
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: "#e5e7eb" }}
                  >
                    <svg className="w-3.5 h-3.5" style={{ color: "#6b7280" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                    </svg>
                  </div>
                )}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* ── Input area ────────────────────────────────────── */}
      <div className="flex-shrink-0 px-4 pb-4 pt-2" style={{ borderTop: "1px solid #e5e7eb", background: "#ffffff" }}>
        {/* Run status line */}
        {(isLoading || runStatus === "completed") && (
          <div className="max-w-3xl mx-auto mb-2 flex items-center gap-2">
            <span
              className="text-[11px] font-medium px-2 py-0.5 rounded"
              style={isLoading
                ? { background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0" }
                : { background: "#f3f4f6", color: "#6b7280", border: "1px solid #e5e7eb" }
              }
            >
              {isLoading ? "Running" : "Completed"}
            </span>
            <span className="text-[11px]" style={{ color: "#9ca3af" }}>
              {isLoading ? "Bob is searching the knowledge base…" : "Continuing in the same Bob workspace."}
            </span>
          </div>
        )}

        <div className="max-w-3xl mx-auto">
          <div
            className="rounded-xl transition-all"
            style={{ border: "1px solid #d1d5db", background: "#ffffff" }}
            onFocusCapture={e => { (e.currentTarget as HTMLElement).style.borderColor = "#9ca3af"; }}
            onBlurCapture={e => { (e.currentTarget as HTMLElement).style.borderColor = "#d1d5db"; }}
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => { setInput(e.target.value); setCharCount(e.target.value.length); }}
              onKeyDown={handleKeyDown}
              placeholder={kbReady ? "Give Bob a task, or ask a follow-up…" : "Build the knowledge base first…"}
              disabled={!kbReady || isLoading}
              rows={3}
              maxLength={20000}
              className="w-full px-4 pt-3.5 pb-2 text-sm resize-none focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                minHeight: "80px",
                maxHeight: "200px",
                background: "transparent",
                color: "#111827",
              }}
              onInput={e => {
                const t = e.target as HTMLTextAreaElement;
                t.style.height = "auto";
                t.style.height = Math.min(t.scrollHeight, 200) + "px";
              }}
            />
            <div className="flex items-center justify-between px-3 pb-2.5">
              <p className="text-[11px]" style={{ color: "#9ca3af" }}>
                Enter to send · Shift + Enter for a new line
              </p>
              <div className="flex items-center gap-2">
                <span className="text-[11px]" style={{ color: "#9ca3af" }}>{charCount} / 20,000</span>
                {isLoading && (
                  <button
                    onClick={() => { abortRef.current?.abort(); setIsLoading(false); isStreamingRef.current = false; }}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors"
                    style={{ color: "#374151", border: "1px solid #d1d5db" }}
                    onMouseEnter={e => { e.currentTarget.style.background = "#f9fafb"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                  >
                    Cancel run
                  </button>
                )}
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || !kbReady || isLoading}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={(!input.trim() || !kbReady || isLoading)
                    ? { background: "#e5e7eb", color: "#9ca3af", cursor: "not-allowed" }
                    : { background: "#1c2b1c", color: "#e8f0e8" }
                  }
                  onMouseEnter={e => { if (!(!input.trim() || !kbReady || isLoading)) e.currentTarget.style.background = "#2d4a2d"; }}
                  onMouseLeave={e => { if (!(!input.trim() || !kbReady || isLoading)) e.currentTarget.style.background = "#1c2b1c"; }}
                >
                  Send message
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 10l7-7m0 0l7 7m-7-7v18"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
          <p className="text-[11px] mt-1.5 px-1" style={{ color: "#9ca3af" }}>
            Bob can search docs and answer questions about IBM Building Blocks.
          </p>
        </div>
      </div>
    </div>
  );
}
