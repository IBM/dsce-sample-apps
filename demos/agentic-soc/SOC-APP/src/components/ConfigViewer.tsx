'use client';

import React, { useState, useEffect } from 'react';
import { FileText, ChevronDown, ChevronUp, BookOpen } from 'lucide-react';

interface ConfigFile {
  id: string;
  label: string;
  group: string;
  content: string;
}

interface ConfigViewerProps {
  open: boolean;
  onToggle: () => void;
}

const GROUP_ORDER = ['Agents', 'Config'];

export const ConfigViewer: React.FC<ConfigViewerProps> = ({ open, onToggle }) => {
  const [files, setFiles] = useState<ConfigFile[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  // Fetch once when the panel is first opened
  useEffect(() => {
    if (!open || fetched) return;
    setLoading(true);
    fetch('/api/config-files')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.files)) {
          setFiles(data.files);
          if (data.files.length > 0) setSelectedId(data.files[0].id);
        }
        setFetched(true);
      })
      .catch(() => {
        setFetched(true);
      })
      .finally(() => setLoading(false));
  }, [open, fetched]);

  const selectedFile = files.find((f) => f.id === selectedId);

  const grouped = GROUP_ORDER.map((group) => ({
    group,
    items: files.filter((f) => f.group === group),
  })).filter((g) => g.items.length > 0);

  return (
    <section className="rounded-2xl border border-slate-800/60 bg-[#0d1117] overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800/60 bg-gradient-to-br from-indigo-900/80 to-indigo-800/60 cursor-pointer select-none"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-500/15 text-indigo-400">
            <BookOpen className="h-3.5 w-3.5" />
          </div>
          <h2 className="text-sm font-semibold text-slate-100 tracking-tight">
            Agent &amp; Config Files
          </h2>
          <span className="rounded-full border border-slate-700/60 bg-slate-800/60 px-2 py-0.5 text-[10px] font-mono text-slate-500">
            {files.length > 0 ? `${files.length} files` : 'config files'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden sm:block text-[11px] font-mono text-indigo-200/50">
            Agent instructions &amp; config
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); onToggle(); }}
            className="flex items-center justify-center h-6 w-6 rounded-md text-indigo-300 hover:text-white transition-colors"
          >
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Body */}
      {open && (
        <div className="flex" style={{ minHeight: '480px', maxHeight: '70vh' }}>

          {/* Left — file list */}
          <aside className="w-56 shrink-0 border-r border-slate-800/60 bg-[#0a0c16] overflow-y-auto">
            {loading && (
              <div className="px-4 py-6 text-xs text-slate-500 font-mono">Loading…</div>
            )}
            {!loading && grouped.map(({ group, items }) => (
              <div key={group}>
                <div className="px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-600 select-none">
                  {group}
                </div>
                {items.map((file) => (
                  <button
                    key={file.id}
                    onClick={() => setSelectedId(file.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs transition-colors rounded-none
                      ${selectedId === file.id
                        ? 'bg-indigo-600/20 text-indigo-300 border-r-2 border-indigo-500'
                        : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                      }`}
                  >
                    <FileText className="h-3.5 w-3.5 shrink-0 opacity-70" />
                    <span className="truncate leading-snug">{file.label}</span>
                  </button>
                ))}
              </div>
            ))}
            {!loading && files.length === 0 && fetched && (
              <div className="px-4 py-6 text-xs text-slate-600 font-mono">
                No files loaded — check COS configuration.
              </div>
            )}
          </aside>

          {/* Right — content pane */}
          <div className="flex-1 overflow-hidden flex flex-col bg-[#080a12]">
            {selectedFile && (
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-800/60 bg-[#0a0c16]">
                <FileText className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                <span className="text-xs font-mono text-slate-300">{selectedFile.label}</span>
                <span className="ml-auto text-[10px] font-mono text-slate-600">
                  {selectedFile.content.split('\n').length} lines
                </span>
              </div>
            )}

            <div className="flex-1 overflow-y-auto overflow-x-auto">
              {!selectedFile && !loading && (
                <div className="px-6 py-10 text-xs text-slate-600 font-mono">
                  Select a file from the list on the left.
                </div>
              )}
              {selectedFile && (
                <pre className="text-[11px] font-mono text-slate-300 leading-relaxed whitespace-pre p-4 min-w-0">
                  {selectedFile.content}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
