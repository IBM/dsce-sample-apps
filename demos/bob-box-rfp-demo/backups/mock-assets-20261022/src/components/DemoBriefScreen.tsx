import React, { useState } from 'react';
import { Finding, BoxDocument } from '../types';
import { 
  Sparkles, 
  FileText, 
  ShieldCheck, 
  ArrowRight, 
  CheckCircle2, 
  HelpCircle, 
  AlertTriangle, 
  Clock, 
  FileCheck, 
  ChevronRight,
  MessageSquare
} from 'lucide-react';

interface DemoBriefScreenProps {
  findings: Finding[];
  documents: BoxDocument[];
  onSelectFinding: (finding: Finding) => void;
  onBuildDemoPlan: () => void;
  onViewAllSources: () => void;
  onOpenAskBob: () => void;
  onResetDemo: () => void;
}

export const DemoBriefScreen: React.FC<DemoBriefScreenProps> = ({
  findings,
  documents,
  onSelectFinding,
  onBuildDemoPlan,
  onViewAllSources,
  onOpenAskBob,
  onResetDemo,
}) => {
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>('all');

  const categories = [
    { key: 'all', label: 'All Findings' },
    { key: 'what_acme_wants_to_see', label: 'What Acme Wants to See' },
    { key: 'pain_points', label: 'Documented Pain Points' },
    { key: 'technical_requirements', label: 'Technical Requirements' },
    { key: 'open_questions', label: 'Open Questions' },
    { key: 'recent_requests', label: 'Recent Requests' },
  ];

  const getDocName = (docId: string): string => {
    const doc = documents.find(d => d.id === docId);
    return doc ? doc.name : docId;
  };

  const getCategoryMeta = (cat: string) => {
    switch (cat) {
      case 'what_acme_wants_to_see':
        return {
          title: '1. What Acme Explicitly Wants to See',
          subtitle: 'Specific capabilities and use cases requested by Acme stakeholders',
          badge: 'bg-blue-50 text-blue-700 border-blue-200',
          icon: <FileCheck className="w-4 h-4 text-blue-600" />
        };
      case 'pain_points':
        return {
          title: '2. Documented Pain Points',
          subtitle: 'Operational bottlenecks identified across discovery and workflow notes',
          badge: 'bg-amber-50 text-amber-700 border-amber-200',
          icon: <AlertTriangle className="w-4 h-4 text-amber-600" />
        };
      case 'technical_requirements':
        return {
          title: '3. Technical Requirements Found',
          subtitle: 'Architecture, security, and integration criteria mandated by CISO and IT',
          badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          icon: <ShieldCheck className="w-4 h-4 text-emerald-600" />
        };
      case 'open_questions':
        return {
          title: '4. Open Questions (Unresolved)',
          subtitle: 'Items currently under review or unmetered in existing customer documentation',
          badge: 'bg-purple-50 text-purple-700 border-purple-200',
          icon: <HelpCircle className="w-4 h-4 text-purple-600" />
        };
      case 'recent_requests':
        return {
          title: '5. Recent Customer Requests',
          subtitle: 'Direct briefing notes and timing guidelines for tomorrow’s demo',
          badge: 'bg-indigo-50 text-indigo-700 border-indigo-200',
          icon: <Clock className="w-4 h-4 text-indigo-600" />
        };
      default:
        return {
          title: 'Customer Finding',
          subtitle: '',
          badge: 'bg-gray-50 text-gray-700 border-gray-200',
          icon: <FileText className="w-4 h-4 text-gray-600" />
        };
    }
  };

  // Group findings by category for structured layout
  const sections: ('what_acme_wants_to_see' | 'pain_points' | 'technical_requirements' | 'open_questions' | 'recent_requests')[] = [
    'what_acme_wants_to_see',
    'pain_points',
    'technical_requirements',
    'open_questions',
    'recent_requests',
  ];

  return (
    <div className="flex-1 py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full animate-slide-up">
      {/* Top Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-1.5 rounded-lg bg-[#0f62fe] text-white">
              <Sparkles className="w-5 h-5" />
            </span>
            <h2 className="text-2xl font-bold text-gray-900">
              Acme Corp Demo Preparation Brief
            </h2>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Synthesized across 12 Box workspace files. Select any finding to inspect supporting document excerpts.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2 self-start lg:self-auto">
          <button
            onClick={onViewAllSources}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 rounded-xl border border-gray-200 shadow-xs transition-colors cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-blue-600" />
            <span>View 12 Sources</span>
          </button>

          <button
            onClick={onBuildDemoPlan}
            className="inline-flex items-center space-x-2 px-5 py-2 text-sm font-semibold text-white bg-[#0f62fe] hover:bg-[#0043ce] rounded-xl shadow-md transition-all cursor-pointer"
          >
            <span>Build My Demo Plan</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Category Filter Chips */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-2 mb-6">
        {categories.map(cat => (
          <button
            key={cat.key}
            onClick={() => setActiveCategoryFilter(cat.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
              activeCategoryFilter === cat.key
                ? 'bg-gray-900 text-white shadow-xs'
                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Render Findings */}
      <div className="space-y-8 mb-8">
        {sections
          .filter(sec => activeCategoryFilter === 'all' || activeCategoryFilter === sec)
          .map(sec => {
            const meta = getCategoryMeta(sec);
            const sectionFindings = findings.filter(f => f.category === sec);

            if (sectionFindings.length === 0) return null;

            return (
              <div key={sec} className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 shadow-xs">
                {/* Section Header */}
                <div className="flex items-center justify-between pb-4 mb-4 border-b border-gray-100">
                  <div className="flex items-center space-x-2.5">
                    <span className="p-1 rounded-md bg-gray-50 border border-gray-200">
                      {meta.icon}
                    </span>
                    <div>
                      <h3 className="text-base font-bold text-gray-900">{meta.title}</h3>
                      <p className="text-xs text-gray-500">{meta.subtitle}</p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-700">
                    {sectionFindings.length} items
                  </span>
                </div>

                {/* Findings Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {sectionFindings.map(finding => {
                    const isStrong = finding.supportingSourceCount >= 3;

                    return (
                      <div
                        key={finding.id}
                        onClick={() => onSelectFinding(finding)}
                        className="p-4 rounded-xl border border-gray-200 hover:border-blue-400 bg-gray-50/50 hover:bg-white hover:shadow-card transition-all cursor-pointer flex flex-col justify-between group"
                      >
                        <div>
                          {/* Finding Title & Badge */}
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <h4 className="text-sm font-semibold text-gray-900 group-hover:text-blue-700 transition-colors">
                              {finding.title}
                            </h4>
                            <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-semibold border flex-shrink-0 ${
                              isStrong ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-gray-100 text-gray-700 border-gray-200'
                            }`}>
                              <CheckCircle2 className="w-3 h-3 text-blue-600" />
                              <span>{finding.supportingSourceCount} {finding.supportingSourceCount === 1 ? 'source' : 'sources'}</span>
                            </span>
                          </div>

                          {/* Grounded Statement */}
                          <p className="text-xs text-gray-600 leading-relaxed mb-3">
                            {finding.statement}
                          </p>
                        </div>

                        {/* Source Tags & Inspect Link */}
                        <div className="pt-2.5 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
                          <div className="truncate max-w-[200px] flex items-center space-x-1">
                            <FileText className="w-3 h-3 text-gray-400 flex-shrink-0" />
                            <span className="truncate text-gray-600">
                              {finding.supportingDocumentIds.map(id => getDocName(id)).join(', ')}
                            </span>
                          </div>

                          <span className="inline-flex items-center space-x-1 text-blue-600 font-medium group-hover:translate-x-0.5 transition-transform flex-shrink-0">
                            <span>Inspect Evidence</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
      </div>

      {/* Bottom Sticky Action Bar */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-3 text-xs text-gray-600">
          <button
            onClick={onOpenAskBob}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold transition-colors cursor-pointer"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Ask Bob a Question</span>
          </button>
          <span className="hidden md:inline text-gray-400">•</span>
          <span className="hidden md:inline text-gray-500">
            Ready to generate the customer-specific presentation flow?
          </span>
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <button
            onClick={onResetDemo}
            className="px-3.5 py-2 text-xs font-medium text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors cursor-pointer"
          >
            Reset
          </button>

          <button
            onClick={onBuildDemoPlan}
            className="flex-1 sm:flex-none inline-flex items-center justify-center space-x-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#0f62fe] hover:bg-[#0043ce] shadow-md transition-all cursor-pointer"
          >
            <span>Build My Demo Plan</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
