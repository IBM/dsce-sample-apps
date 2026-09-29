"use client";

import { useState, useCallback } from "react";
import Sidebar from "@/components/Sidebar";
import ChatPanel from "@/components/ChatPanel";

export default function Home() {
  const [activeThreadId, setActiveThreadId]       = useState<string | null>(null);
  const [activeThreadTitle, setActiveThreadTitle] = useState<string | null>(null);
  const [kbReady, setKbReady]                     = useState(false);
  const [newThreadSignal, setNewThreadSignal]     = useState<{ id: string; title: string } | null>(null);

  // KB refresh state lifted here so Sidebar and ChatPanel can share it
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [crawlLog, setCrawlLog]         = useState("");

  const handleRefreshKB = useCallback(async () => {
    setIsRefreshing(true);
    setCrawlLog("Starting agentic crawl…");
    try {
      const res = await fetch("/api/kb-status", { method: "POST" });
      if (!res.body) throw new Error("No response body");
      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "", bobOutput = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === "status") {
              setCrawlLog(event.text);
            } else if (event.type === "bob_chunk") {
              bobOutput += event.text;
              setCrawlLog(bobOutput.slice(-120).replace(/\n+/g, " ").trim());
            } else if (event.type === "done") {
              setIsRefreshing(false);
              setCrawlLog(`✓ ${event.page_count} pages indexed`);
              setTimeout(() => setCrawlLog(""), 6000);
            } else if (event.type === "error") {
              setIsRefreshing(false);
              setCrawlLog(event.text);
              setTimeout(() => setCrawlLog(""), 8000);
            }
          } catch { /* skip */ }
        }
      }
    } catch (err: any) {
      setIsRefreshing(false);
      setCrawlLog(`Error: ${err.message}`);
      setTimeout(() => setCrawlLog(""), 6000);
    }
  }, []);

  function handleSelectThread(id: string, title: string) {
    setActiveThreadId(id);
    setActiveThreadTitle(title);
  }

  function handleNewChat() {
    setActiveThreadId(null);
    setActiveThreadTitle(null);
  }

  function handleThreadCreated(id: string, title: string) {
    setActiveThreadId(id);
    setActiveThreadTitle(title);
    setNewThreadSignal({ id, title });
    setTimeout(() => setNewThreadSignal(null), 100);
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#f3f4f6" }}>
      {/* Sidebar */}
      <div className="w-[220px] flex-shrink-0">
        <Sidebar
          activeThreadId={activeThreadId}
          onSelectThread={(id, title) => handleSelectThread(id, title)}
          onNewChat={handleNewChat}
          onKBReady={setKbReady}
          newThreadSignal={newThreadSignal}
          onRefreshKB={handleRefreshKB}
          isRefreshing={isRefreshing}
          crawlLog={crawlLog}
        />
      </div>

      {/* Main chat area */}
      <div className="flex-1 min-w-0">
        <ChatPanel
          threadId={activeThreadId}
          threadTitle={activeThreadTitle}
          onThreadCreated={handleThreadCreated}
          kbReady={kbReady}
        />
      </div>
    </div>
  );
}
