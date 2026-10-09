'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MessageSquare, X, Send, RotateCcw, Bot, Loader2, AlertCircle, ChevronDown } from 'lucide-react';

interface ChatMessage {
  role: 'user' | 'assistant' | 'error';
  content: string;
  status?: string;
  durationMs?: number | null;
}

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS  = 360000;

export function WxoChatWidget() {
  const [open, setOpen]             = useState(false);
  const [messages, setMessages]     = useState<ChatMessage[]>([]);
  const [input, setInput]           = useState('');
  const [thinking, setThinking]     = useState(false);
  const [threadId, setThreadId]     = useState<string | null>(null);
  const [statusLine, setStatusLine] = useState<string>('');
  const [unread, setUnread]         = useState(0);

  const bottomRef   = useRef<HTMLDivElement>(null);
  const inputRef    = useRef<HTMLTextAreaElement>(null);
  const thinkingRef = useRef(false);

  // scroll to bottom whenever messages or statusLine change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, statusLine]);

  // focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 120);
      setUnread(0);
    }
  }, [open]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || thinkingRef.current) return;

    setInput('');
    thinkingRef.current = true;
    setThinking(true);

    setMessages(prev => [...prev, { role: 'user', content: text }]);

    try {
      // Step 1: POST — create run
      const postRes = await fetch('/api/chat-conv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, threadId }),
      });
      const postData = await postRes.json();

      if (!postRes.ok || !postData.success) {
        throw new Error(postData.error || 'Failed to start supervisor agent run.');
      }

      const { runId, threadId: newThreadId, startedAt } = postData;
      if (newThreadId) setThreadId(newThreadId);

      setStatusLine('Supervisor agent is thinking…');

      // Step 2: poll until done
      const deadline = Date.now() + POLL_TIMEOUT_MS;
      let pollCount  = 0;

      while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
        pollCount++;

        const pollUrl = `/api/chat-conv/${encodeURIComponent(runId)}`
          + `?startedAt=${encodeURIComponent(startedAt)}`
          + `&threadId=${encodeURIComponent(newThreadId || threadId || '')}`;

        const pollRes  = await fetch(pollUrl);
        const pollData = await pollRes.json();

        if (!pollRes.ok || !pollData.success) {
          throw new Error(pollData.error || 'Error polling supervisor agent.');
        }

        if (!pollData.completed) {
          const elapsedS = Math.round((Date.now() - new Date(startedAt).getTime()) / 1000);
          setStatusLine(`Supervisor agent running… ${elapsedS}s (poll #${pollCount})`);
          continue;
        }

        // Done
        if (pollData.threadId) setThreadId(pollData.threadId);
        setStatusLine('');
        setMessages(prev => [
          ...prev,
          {
            role:       'assistant',
            content:    pollData.outputText || '(No response from agent)',
            status:     pollData.status,
            durationMs: pollData.analytics?.durationMs ?? null,
          },
        ]);

        if (!open) setUnread(u => u + 1);
        return;
      }

      throw new Error('Client timed out waiting for supervisor agent response.');
    } catch (err: any) {
      setStatusLine('');
      setMessages(prev => [...prev, { role: 'error', content: err.message }]);
    } finally {
      thinkingRef.current = false;
      setThinking(false);
    }
  }, [input, threadId, open]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleReset = () => {
    setMessages([]);
    setThreadId(null);
    setStatusLine('');
    setInput('');
  };

  return (
    <>
      {/* Floating toggle button */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-label={open ? 'Close chat' : 'Open Supervisor Agent chat'}
        className={[
          'fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full',
          'shadow-lg shadow-indigo-900/60 transition-all duration-200',
          open
            ? 'bg-slate-800 border border-slate-700 hover:bg-slate-700'
            : 'bg-indigo-600 hover:bg-indigo-500 border border-indigo-400/40',
        ].join(' ')}
      >
        {open
          ? <ChevronDown className="h-5 w-5 text-slate-300" />
          : (
            <span className="relative">
              <MessageSquare className="h-6 w-6 text-white" />
              {unread > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                  {unread}
                </span>
              )}
            </span>
          )
        }
      </button>

      {/* Chat panel */}
      <div
        className={[
          'fixed bottom-24 right-6 z-50 flex flex-col',
          'w-[360px] sm:w-[420px] max-h-[600px]',
          'rounded-2xl border border-slate-700/60 bg-[#0d1117]',
          'shadow-2xl shadow-indigo-950/70',
          'transition-all duration-200 origin-bottom-right',
          open ? 'scale-100 opacity-100 pointer-events-auto' : 'scale-95 opacity-0 pointer-events-none',
        ].join(' ')}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 rounded-t-2xl border-b border-slate-800/70 bg-gradient-to-r from-indigo-950/90 to-violet-950/80 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/20 ring-1 ring-indigo-400/30">
              <Bot className="h-4 w-4 text-indigo-300" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white leading-none">Conversational Supervisor</p>
              <p className="text-[10px] text-indigo-300/70 mt-0.5">watsonx Orchestrate · SOC</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {threadId && (
              <button
                onClick={handleReset}
                title="Reset conversation"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-800 hover:text-slate-300 transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-800 hover:text-slate-300 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Thread ID pill */}
        {threadId && (
          <div className="px-4 py-1.5 border-b border-slate-800/50 bg-slate-900/40">
            <span className="text-[10px] font-mono text-slate-600">thread: {threadId.slice(0, 18)}…</span>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-[200px]">
          {messages.length === 0 && !thinking && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-500/10 ring-1 ring-indigo-500/20">
                <Bot className="h-6 w-6 text-indigo-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-300">Ask the Supervisor</p>
                <p className="text-xs text-slate-600 mt-1 max-w-[260px]">
                  Ask about any offense — the conversational supervisor will guide you through the 6-agent pipeline step by step.
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5 justify-center mt-1">
                {[
                  'Analyze offense #1234',
                  'What is the pipeline status?',
                  'Classify this IP: 10.0.0.1',
                ].map(s => (
                  <button
                    key={s}
                    onClick={() => setInput(s)}
                    className="rounded-full border border-slate-700 bg-slate-800/60 px-2.5 py-1 text-[10px] text-slate-400 hover:border-indigo-500/50 hover:text-indigo-300 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={['flex gap-2.5', msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'].join(' ')}
            >
              {msg.role !== 'user' && (
                <div className={[
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full mt-0.5',
                  msg.role === 'error' ? 'bg-red-500/20' : 'bg-indigo-500/20',
                ].join(' ')}>
                  {msg.role === 'error'
                    ? <AlertCircle className="h-3.5 w-3.5 text-red-400" />
                    : <Bot className="h-3.5 w-3.5 text-indigo-300" />
                  }
                </div>
              )}
              <div
                className={[
                  'max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-tr-sm'
                    : msg.role === 'error'
                      ? 'bg-red-900/30 border border-red-700/40 text-red-300 rounded-tl-sm'
                      : 'bg-slate-800/80 border border-slate-700/50 text-slate-200 rounded-tl-sm',
                ].join(' ')}
              >
                <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                {msg.role === 'assistant' && msg.durationMs != null && (
                  <p className="mt-1 text-[10px] text-slate-600 font-mono">{(msg.durationMs / 1000).toFixed(1)}s · {msg.status}</p>
                )}
              </div>
            </div>
          ))}

          {/* Thinking indicator */}
          {thinking && (
            <div className="flex gap-2.5">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 mt-0.5">
                <Loader2 className="h-3.5 w-3.5 text-indigo-300 animate-spin" />
              </div>
              <div className="max-w-[82%] rounded-2xl rounded-tl-sm bg-slate-800/80 border border-slate-700/50 px-3.5 py-2.5">
                <p className="text-xs text-slate-500 font-mono">{statusLine || 'Submitting…'}</p>
                <div className="mt-1.5 flex gap-1">
                  {[0, 1, 2].map(n => (
                    <span key={n} className="h-1.5 w-1.5 rounded-full bg-indigo-400/60 animate-bounce" style={{ animationDelay: `${n * 0.15}s` }} />
                  ))}
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t border-slate-800/70 bg-[#0a0c16] rounded-b-2xl px-3 py-3">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={thinking}
              rows={1}
              placeholder="Ask the supervisor agent…"
              className={[
                'flex-1 resize-none rounded-xl border bg-slate-900/80 px-3 py-2.5 text-sm text-slate-200',
                'placeholder-slate-600 outline-none transition-colors',
                'max-h-28 overflow-y-auto',
                thinking
                  ? 'border-slate-800 opacity-40 cursor-not-allowed'
                  : 'border-slate-700 focus:border-indigo-500/60',
              ].join(' ')}
              style={{ fieldSizing: 'content' } as React.CSSProperties}
            />
            <button
              onClick={sendMessage}
              disabled={thinking || !input.trim()}
              className={[
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all',
                thinking || !input.trim()
                  ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                  : 'bg-indigo-600 text-white hover:bg-indigo-500 active:scale-95',
              ].join(' ')}
            >
              {thinking
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Send className="h-4 w-4" />
              }
            </button>
          </div>
          <p className="mt-1.5 text-[10px] text-slate-700 text-center">
            Enter to send · Shift+Enter for new line{threadId ? ' · conversation active' : ''}
          </p>
        </div>
      </div>
    </>
  );
}
