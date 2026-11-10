import React, { useState, useEffect } from 'react';
import { BoxDocument, ChatMessage, Finding } from '../types';
import { detectCustomerName, scoreDocumentRelevance } from '../services/assetGenerator';
import { askBobChat, checkHeadlessBobStatus } from '../services/headlessBobService';
import { BobLogo } from './BobLogo';
import {
  X,
  Send,
  FileText,
  Eye,
  Sparkles,
  Loader2
} from 'lucide-react';

interface AskBobDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  documents: BoxDocument[];
  findings: Finding[];
  onPreviewDocument: (doc: BoxDocument) => void;
}

// ─── Live document search ─────────────────────────────────────────────────────

/**
 * Answer a free-text question by searching live documents and derived findings.
 * Returns structured answer text, supporting doc IDs, and evidence confidence.
 */
function searchLiveDocuments(
  query: string,
  documents: BoxDocument[],
  findings: Finding[],
): {
  answer: string;
  grounded: boolean;
  insufficientEvidence: boolean;
  supportingDocumentIds: string[];
} {
  const q = query.trim().toLowerCase();
  if (!q) {
    return {
      answer: 'Please enter a question about your customer context or demo preparation.',
      grounded: true,
      insufficientEvidence: false,
      supportingDocumentIds: [],
    };
  }

  // 1. Search findings first — they are already categorised and evidence-grounded
  const stopWords = new Set(['the','a','an','is','are','was','were','to','for','of','in','on','and','or','with','that','this','what','how','can','do','does','will','be','at','by','from','we','i','it','its','about']);
  const keywords = q.split(/\W+/).filter(w => w.length > 2 && !stopWords.has(w));

  const scoredFindings = findings
    .map(f => {
      const haystack = `${f.title} ${f.statement} ${f.groundedSummary} ${f.excerpts.map(e => e.text).join(' ')}`.toLowerCase();
      const hits = keywords.filter(k => haystack.includes(k)).length;
      return { finding: f, score: keywords.length > 0 ? hits / keywords.length : 0 };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score);

  if (scoredFindings.length > 0) {
    const top = scoredFindings.slice(0, 3);
    const supportingDocumentIds = [...new Set(top.flatMap(({ finding: f }) => f.supportingDocumentIds))];
    const docNames = supportingDocumentIds
      .map(id => documents.find(d => d.id === id)?.name)
      .filter(Boolean)
      .join(', ');

    const lines: string[] = [];
    top.forEach(({ finding: f }) => {
      lines.push(`📌 ${f.title}`);
      lines.push(f.statement);
      if (f.excerpts[0]) {
        lines.push(`   → From "${f.excerpts[0].documentName}"${f.excerpts[0].section !== 'Document Content' ? ` (${f.excerpts[0].section})` : ''}`);
      }
      lines.push('');
    });

    return {
      answer: `Based on ${supportingDocumentIds.length} Box document(s) (${docNames || 'customer files'}):\n\n${lines.join('\n').trim()}`,
      grounded: true,
      insufficientEvidence: false,
      supportingDocumentIds,
    };
  }

  // 2. Fall back to full-text search across document content
  const scoredDocs = documents
    .map(doc => ({ doc, score: scoreDocumentRelevance(doc, query) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  if (scoredDocs.length > 0) {
    const lines: string[] = [];
    scoredDocs.forEach(({ doc }) => {
      // Extract the most relevant sentence from the document
      const sentences = (doc.fullContent ?? doc.summary ?? '')
        .split(/(?<=[.!?])\s+|\n+/)
        .map(s => s.trim())
        .filter(s => s.length > 30 && s.length < 400);
      const bestSentence = sentences.find(s =>
        keywords.some(k => s.toLowerCase().includes(k))
      ) ?? doc.summary ?? '';
      lines.push(`📄 ${doc.name}`);
      if (bestSentence) lines.push(`   "${bestSentence.slice(0, 220)}${bestSentence.length > 220 ? '…' : ''}"`);
      lines.push('');
    });

    return {
      answer: `I found ${scoredDocs.length} relevant Box document(s) matching your inquiry:\n\n${lines.join('\n').trim()}`,
      grounded: true,
      insufficientEvidence: false,
      supportingDocumentIds: scoredDocs.map(({ doc }) => doc.id),
    };
  }

  // 3. Strict evidence guardrail
  return {
    answer: `I could not find sufficient evidence in the available Box content to answer that question. ${documents.length} file${documents.length !== 1 ? 's' : ''} were reviewed but this specific detail was not documented. Please ask about the customer's documented requirements, pain points, technical mandates, or open questions.`,
    grounded: true,
    insufficientEvidence: true,
    supportingDocumentIds: [],
  };
}

// ─── Suggested questions derived from live findings ───────────────────────────

function deriveSuggestedQuestions(findings: Finding[]): string[] {
  const suggestions: string[] = [];

  const pain = findings.find(f => f.category === 'pain_points');
  const want = findings.find(f => f.category === 'what_acme_wants_to_see');
  const tech = findings.find(f => f.category === 'technical_requirements');
  const open = findings.find(f => f.category === 'open_questions');

  if (pain) suggestions.push(`What are the documented pain points?`);
  if (want) suggestions.push(`What does the customer want to see in the demo?`);
  if (tech) suggestions.push(`What security & compliance requirements were documented?`);
  if (open) suggestions.push(`What questions remain unanswered?`);

  // Fill to 4
  if (suggestions.length < 4) suggestions.push(`Which files mention integration requirements?`);
  if (suggestions.length < 4) suggestions.push(`What should I deprioritize in the demo?`);

  return suggestions.slice(0, 4);
}

// ─── Component ────────────────────────────────────────────────────────────────

export const AskBobDrawer: React.FC<AskBobDrawerProps> = ({
  isOpen,
  onClose,
  documents,
  findings,
  onPreviewDocument,
}) => {
  const customerName = detectCustomerName(documents);
  const docCount = documents.length;
  const suggestedQuestions = deriveSuggestedQuestions(findings);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-welcome',
      sender: 'bob',
      text: `Hello! I am IBM Bob. I have reviewed all ${docCount} document${docCount !== 1 ? 's' : ''} in ${customerName}'s Box workspace. Ask me about documented requirements, pain points, security policies, or unconfirmed items.`,
      grounded: true,
      timestamp: 'Just now'
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLlmAvailable, setIsLlmAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    checkHeadlessBobStatus().then(status => {
      setIsLlmAvailable(status.isOnline);
    });
  }, []);

  // Keep the initial welcome message synchronized when Box documents finish loading
  useEffect(() => {
    setMessages((prev) => {
      if (prev.length === 1 && prev[0].id === 'msg-welcome') {
        return [
          {
            id: 'msg-welcome',
            sender: 'bob',
            text: `Hello! I am IBM Bob. I have reviewed all ${docCount} document${docCount !== 1 ? 's' : ''} in ${customerName}'s Box workspace. Ask me about documented requirements, pain points, security policies, or unconfirmed items.`,
            grounded: true,
            timestamp: 'Just now'
          }
        ];
      }
      return prev;
    });
  }, [docCount, customerName]);

  if (!isOpen) return null;

  const handleSend = async (queryText: string) => {
    const q = queryText.trim();
    if (!q || isLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: q,
      grounded: true,
      timestamp: 'Just now'
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    setIsLoading(true);

    try {
      // First attempt real Headless Bob LLM call
      const history = messages.slice(-4).map(m => ({
        role: m.sender === 'bob' ? 'assistant' : 'user',
        content: m.text
      }));
      const llmResult = await askBobChat(q, documents, history);

      const bobMsg: ChatMessage = {
        id: `bob-${Date.now() + 1}`,
        sender: 'bob',
        text: llmResult.answer,
        grounded: llmResult.grounded,
        insufficientEvidence: llmResult.insufficientEvidence,
        supportingDocIds: llmResult.supportingDocumentIds,
        timestamp: 'Just now'
      };
      setMessages((prev) => [...prev, bobMsg]);
      setIsLlmAvailable(true);
    } catch {
      // Fallback to local heuristic search
      setIsLlmAvailable(false);
      const result = searchLiveDocuments(q, documents, findings);
      const bobMsg: ChatMessage = {
        id: `bob-${Date.now() + 1}`,
        sender: 'bob',
        text: result.answer,
        grounded: result.grounded,
        insufficientEvidence: result.insufficientEvidence,
        supportingDocIds: result.supportingDocumentIds,
        timestamp: 'Just now'
      };
      setMessages((prev) => [...prev, bobMsg]);
    } finally {
      setIsLoading(false);
    }
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
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-gray-900 text-sm sm:text-base leading-tight">
                  Ask Bob
                </h3>
                {isLlmAvailable && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                    <Sparkles className="w-2.5 h-2.5" /> Headless LLM
                  </span>
                )}
              </div>
              <p className="text-[11px] text-gray-500">
                Grounded in {customerName} Box Workspace ({docCount} Files)
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
          {suggestedQuestions.map((question) => (
            <button
              key={question}
              onClick={() => handlePromptClick(question)}
              className="px-2.5 py-1 rounded-full bg-white hover:bg-blue-50 hover:text-blue-700 border border-gray-200 text-[11px] text-gray-700 font-medium whitespace-nowrap transition-colors flex-shrink-0 cursor-pointer"
            >
              {question}
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

          {/* Typing Indicator */}
          {isLoading && (
            <div className="flex items-center space-x-2 text-xs text-blue-700 bg-blue-50 p-3 rounded-2xl border border-blue-200 animate-pulse">
              <Loader2 className="w-4 h-4 animate-spin text-blue-600 flex-shrink-0" />
              <span>IBM Bob is reasoning over {customerName} Box records...</span>
            </div>
          )}
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
              placeholder={`Ask Bob about ${customerName}'s customer context…`}
              disabled={isLoading}
              className="flex-1 px-3.5 py-2.5 text-xs rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isLoading}
              className="p-2.5 rounded-xl bg-[#0f62fe] text-white hover:bg-[#0043ce] disabled:opacity-40 transition-colors shadow-xs cursor-pointer flex-shrink-0"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
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
