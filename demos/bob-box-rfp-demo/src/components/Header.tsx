import React from 'react';
import { RefreshCw, Database, Sparkles } from 'lucide-react';
import { BobLogo } from './BobLogo';
import { BoxLogo } from './BoxLogo';

interface HeaderProps {
  onResetDemo: () => void;
  sourceMode: 'loading' | 'mock' | 'live_mcp';
  sourceError?: string;
  documentCount: number;
  customerName?: string;
  bobLlmStatus?: 'checking' | 'connected' | 'analyzing' | 'offline';
}

export const Header: React.FC<HeaderProps> = ({
  onResetDemo,
  sourceMode,
  sourceError,
  documentCount,
  customerName,
  bobLlmStatus = 'offline',
}) => {
  const isLive = sourceMode === 'live_mcp';
  const isLoading = sourceMode === 'loading';
  const pillStyle = isLive
    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
    : isLoading
      ? 'bg-gray-50 border-gray-200 text-gray-600'
      : 'bg-amber-50 border-amber-200 text-amber-700';
  const dotStyle = isLive ? 'bg-emerald-500' : isLoading ? 'bg-gray-400' : 'bg-amber-500';
  const pillLabel = isLoading
    ? 'Box MCP: Connecting...'
    : isLive
      ? `Box MCP: Live (${documentCount} Docs)`
      : `Box MCP: Mock data (${documentCount} Docs)`;

  const isLlmConnected = bobLlmStatus === 'connected';
  const isLlmAnalyzing = bobLlmStatus === 'analyzing';
  const llmPillStyle = isLlmAnalyzing
    ? 'bg-blue-50 border-blue-200 text-blue-700'
    : isLlmConnected
      ? 'bg-purple-50 border-purple-200 text-purple-700'
      : 'bg-gray-50 border-gray-200 text-gray-600';
  const llmDotStyle = isLlmAnalyzing
    ? 'bg-blue-500'
    : isLlmConnected
      ? 'bg-purple-500'
      : 'bg-gray-400';
  const llmLabel = isLlmAnalyzing
    ? 'Headless Bob: Generating...'
    : isLlmConnected
      ? 'Headless Bob: Active (LLM)'
      : 'Bob Engine: Heuristics';
  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm backdrop-blur-md bg-white/95">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand & Title */}
        <div className="flex items-center space-x-3.5">
          <div className="flex items-center space-x-2">
            {/* Bob Logo */}
            <div className="w-9 h-9 rounded-xl bg-gray-900 flex items-center justify-center p-1 shadow-sm hover:scale-105 transition-transform">
              <BobLogo className="w-full h-full" />
            </div>
            {/* Plus / MCP Bridge */}
            <span className="text-gray-300 font-semibold text-xs">+</span>
            {/* Box Logo */}
            <BoxLogo className="text-3xl" />
          </div>

          <div className="hidden md:block h-6 w-px bg-gray-200" />

          <div>
            <div className="flex items-center space-x-2">
              <h1 className="font-semibold text-gray-900 text-sm sm:text-base leading-tight">
                From Customer Context to Customer Demo
              </h1>
              {customerName && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                  {customerName}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 hidden sm:block">
              IBM Bob turns Box customer workspace context into tailored, evidence-backed demos
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Headless Bob Status Pill */}
          <div
            className={`hidden lg:flex items-center space-x-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${llmPillStyle}`}
            title={
              isLlmConnected
                ? 'Headless Bob (Bob Shell 2.0.4) ACP/REST service connected on :8000'
                : 'Using client-side reasoning engine (Headless Bob offline)'
            }
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isLlmAnalyzing || isLlmConnected ? 'animate-pulse' : ''} ${llmDotStyle}`}></span>
            <Sparkles className="w-3.5 h-3.5" />
            <span>{llmLabel}</span>
          </div>

          {/* Box MCP Status Pill */}
          <div
            className={`hidden lg:flex items-center space-x-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${pillStyle}`}
            title={sourceError ?? (isLive ? 'Reading live from your Box account' : undefined)}
          >
            <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${dotStyle}`}></span>
            <Database className="w-3.5 h-3.5" />
            <span>{pillLabel}</span>
          </div>

          {/* Reset */}
          <button
            onClick={onResetDemo}
            className="inline-flex items-center space-x-1 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md border border-gray-200 transition-colors cursor-pointer"
            title="Reset workflow"
          >
            <RefreshCw className="w-3.5 h-3.5 text-gray-500" />
            <span className="hidden sm:inline">Reset</span>
          </button>
        </div>
      </div>
    </header>
  );
};
