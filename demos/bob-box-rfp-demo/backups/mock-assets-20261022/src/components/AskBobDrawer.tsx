import React, { useState } from 'react';
import { BoxDocument } from '../types';
import { findAskBobAnswer, SYNTHETIC_ASK_BOB_DATABASE } from '../data/syntheticAskBob';
import { BobLogo } from './BobLogo';
import {
  X,
  Send,
  FileText,
  Eye
} from 'lucide-react';

interface AskBobDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  documents: BoxDocument[];
  onPreviewDocument: (doc: BoxDocument) => void;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'bob';
  text: string;
  grounded: boolean;
  insufficientEvidence?: boolean;
  supportingDocIds?: string[];
  timestamp: string;
}

export const AskBobDrawer: React.FC<AskBobDrawerProps> = ({
  isOpen,
  onClose,
  documents,
  onPreviewDocument,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-welcome',
      sender: 'bob',
      text: 'Hello! I am IBM Bob. I have reviewed all 12 documents in Acme Corp’s Box workspace. Ask me about documented requirements, pain points, security policies, or unconfirmed items.',
      grounded: true,
      timestamp: 'Just now'
    }
  ]);
  const [inputValue, setInputValue] = useState('');

  if (!isOpen) return null;

  const handleSend = (queryText: string) => {
    const q = queryText.trim();
    if (!q) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: q,
      grounded: true,
      timestamp: 'Just now'
    };

    const result = findAskBobAnswer(q);

    const bobMsg: ChatMessage = {
      id: `bob-${Date.now() + 1}`,
      sender: 'bob',
      text: result.answer,
      grounded: result.grounded,
      insufficientEvidence: result.insufficientEvidence,
      supportingDocIds: result.supportingDocumentIds,
      timestamp: 'Just now'
    };

    setMessages((prev) => [...prev, userMsg, bobMsg]);
    setInputValue('');
  };

  const handlePromptClick = (question: string) => {
    handleSend(question);
  };

  const getDoc = (id: string) => documents.find(d => d.id === id);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs animate-fade-in">
      <div 
        className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col animate-slide-left border-l border-gray-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="p-4 sm:p-5 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50/50 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-gray-900 flex items-center justify-center p-1 shadow-sm">
              <BobLogo className="w-full h-full" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-sm sm:text-base leading-tight">
                Ask Bob
              </h3>
              <p className="text-[11px] text-gray-500">
                Grounded in Acme Box Workspace (12 Files)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-white/80 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Suggested Quick Questions Bar */}
        <div className="p-3 bg-gray-50 border-b border-gray-200 text-xs overflow-x-auto flex items-center space-x-2">
          <span className="text-[10px] font-bold text-gray-400 uppercase flex-shrink-0">
            Suggested:
          </span>
          {SYNTHETIC_ASK_BOB_DATABASE.slice(0, 4).map((item) => (
            <button
              key={item.id}
              onClick={() => handlePromptClick(item.suggestedQuestion)}
              className="px-2.5 py-1 rounded-full bg-white hover:bg-blue-50 hover:text-blue-700 border border-gray-200 text-[11px] text-gray-700 font-medium whitespace-nowrap transition-colors flex-shrink-0 cursor-pointer"
            >
              {item.suggestedQuestion}
            </button>
          ))}
        </div>

        {/* Chat Message Stream */}
        <div className="flex-1 p-4 sm:p-5 overflow-y-auto space-y-4">
          {messages.map((msg) => {
            const isBob = msg.sender === 'bob';

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isBob ? 'items-start' : 'items-end'}`}
              >
                <div
                  className={`max-w-[88%] rounded-2xl p-4 text-xs leading-relaxed ${
                    isBob
                      ? 'bg-gray-50 border border-gray-200 text-gray-900 rounded-tl-xs'
                      : 'bg-[#0f62fe] text-white rounded-tr-xs shadow-xs'
                  }`}
                >
                  {isBob && (
                    <div className="flex items-center space-x-1.5 mb-2 pb-1.5 border-b border-gray-200 text-[10px] font-bold text-blue-700 uppercase tracking-wider">
                      <span className="w-3.5 h-3.5 rounded bg-gray-900 inline-flex items-center justify-center p-0.5">
                        <BobLogo className="w-full h-full" />
                      </span>
                      <span>Bob Response</span>
                      {msg.insufficientEvidence && (
                        <span className="text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                          Insufficient Evidence State
                        </span>
                      )}
                    </div>
                  )}

                  <p className="whitespace-pre-wrap font-sans">
                    {msg.text}
                  </p>

                  {/* Supporting Source Badges */}
                  {isBob && msg.supportingDocIds && msg.supportingDocIds.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-gray-200">
                      <span className="text-[10px] font-bold text-gray-500 uppercase block mb-1">
                        Supporting Box Sources:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {msg.supportingDocIds.map((docId) => {
                          const doc = getDoc(docId);
                          if (!doc) return null;
                          return (
                            <button
                              key={docId}
                              onClick={() => onPreviewDocument(doc)}
                              className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[10px] font-medium transition-colors cursor-pointer"
                            >
                              <FileText className="w-3 h-3 text-blue-500" />
                              <span className="truncate max-w-[140px]">{doc.name}</span>
                              <Eye className="w-2.5 h-2.5" />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <span className="text-[10px] text-gray-400 mt-1 px-1">
                  {msg.timestamp}
                </span>
              </div>
            );
          })}
        </div>

        {/* Input Footer */}
        <div className="p-4 border-t border-gray-200 bg-white">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend(inputValue);
            }}
            className="flex items-center space-x-2"
          >
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask Bob about Acme customer context..."
              className="flex-1 px-3.5 py-2.5 text-xs rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            />
            <button
              type="submit"
              disabled={!inputValue.trim()}
              className="p-2.5 rounded-xl bg-[#0f62fe] text-white hover:bg-[#0043ce] disabled:opacity-40 transition-colors shadow-xs cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>

          <p className="text-[10px] text-gray-400 mt-2 text-center">
            Evidence-First Guardrails: Answers without supporting Box records return an explicit notice.
          </p>
        </div>
      </div>
    </div>
  );
};
