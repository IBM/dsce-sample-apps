import React from 'react';
import { RefreshCw, MessageSquare, Database } from 'lucide-react';
import { ScreenState } from '../types';
import { BobLogo } from './BobLogo';

interface HeaderProps {
  currentScreen: ScreenState;
  onResetDemo: () => void;
  onOpenAskBob: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentScreen,
  onResetDemo,
  onOpenAskBob,
}) => {
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
            {/* Box Logo Badge */}
            <div className="h-9 px-2.5 rounded-xl bg-[#0061d5] text-white flex items-center justify-center font-black text-sm tracking-tight shadow-sm">
              box
            </div>
          </div>

          <div className="hidden md:block h-6 w-px bg-gray-200" />

          <div>
            <div className="flex items-center space-x-2">
              <h1 className="font-semibold text-gray-900 text-sm sm:text-base leading-tight">
                From Customer Context to Customer Demo
              </h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                Acme Corp
              </span>
            </div>
            <p className="text-xs text-gray-500 hidden sm:block">
              IBM Bob turns Box customer workspace context into tailored, evidence-backed demos
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Box MCP Status Pill */}
          <div className="hidden lg:flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <Database className="w-3.5 h-3.5" />
            <span>Box MCP: Ready (12 Docs)</span>
          </div>

          {/* Ask Bob Drawer Button */}
          {currentScreen !== 'landing' && currentScreen !== 'investigating' && (
            <button
              onClick={onOpenAskBob}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#0f62fe] hover:bg-[#0043ce] rounded-md shadow-sm transition-colors cursor-pointer"
              title="Open Grounded Ask Bob Assistant"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Ask Bob</span>
            </button>
          )}

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
