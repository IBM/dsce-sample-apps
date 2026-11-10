import React from 'react';
import {
  ShieldCheck,
  Database,
  Lock,
  FileCheck,
  Target,
  TrendingUp
} from 'lucide-react';
import { BobLogo } from './BobLogo';
import { IbmLogo } from './IbmLogo';
import type { BoxDocument, Finding } from '../types';

export interface SpeakerNotesData {
  objective: string;
  targetAudience: string;
  talkingPoints: string[];
  demoCue: string;
  objectionHandling: string;
  sourceCitation: string;
}

export interface Slide {
  id: number;
  numberStr: string;
  category: string;
  title: string;
  subtitle: string;
  notes: SpeakerNotesData;
  visual: React.ReactNode;
}

/**
 * Context derived from live Box documents passed into the slide builder.
 * Every customer-specific string in the visuals comes from here.
 */
export interface SlideContext {
  customerName: string;        // e.g. "Acme Corp"
  stakeholders: string[];      // e.g. ["Sarah Jenkins", "David Chen"]
  topPainPoint: string;        // e.g. "48-hour manual classification backlog"
  topPainDetail: string;       // e.g. "Staff opens and renames W-9 files manually."
  secondPainPoint: string;     // e.g. "Manual CRM Re-Entry"
  secondPainDetail: string;    // e.g. "Specialists lose 2–3 hours daily typing metadata."
  thirdPainPoint: string;      // e.g. "3 Unindexed Shared Drives"
  thirdPainDetail: string;     // e.g. "Scattered network silos create audit risks."
  topWant: string;             // e.g. "Automated Document Classification"
  docCount: number;            // number of Box files read
  primaryDocName: string;      // e.g. "Discovery_Notes.docx"
  auditDays: string;           // e.g. "365"
}

const DEFAULTS: SlideContext = {
  customerName: 'the Customer',
  stakeholders: [],
  topPainPoint: 'Manual Classification Backlog',
  topPainDetail: 'Staff manually inspects and renames documents upon intake.',
  secondPainPoint: 'Manual CRM Re-Entry',
  secondPainDetail: 'Specialists spend hours daily re-typing metadata into the CRM.',
  thirdPainPoint: 'Disconnected Repositories',
  thirdPainDetail: 'Scattered network silos create missing files and audit risks.',
  topWant: 'Automated Document Classification & Workflow Modernization',
  docCount: 0,
  primaryDocName: 'Discovery Notes',
  auditDays: '365',
};

/** Build a SlideContext from live documents + findings (shared by the viewer and the Box export) */
export function buildSlideContext(documents: BoxDocument[], findings: Finding[]): Partial<SlideContext> {
  if (documents.length === 0) return {};

  const customerName = (() => {
    for (const doc of documents) {
      const parts = doc.folderPath.split('/').map(s => s.trim());
      const idx = parts.findIndex(p => p.toLowerCase() === 'customers');
      if (idx !== -1 && parts[idx + 1]) return parts[idx + 1];
    }
    return 'the Customer';
  })();

  const stakeholders: string[] = [];
  for (const doc of documents) {
    const m = doc.fullContent?.match(/Participants?:[^\n]+/i);
    if (m) {
      m[0].replace(/Participants?:\s*/i, '').split(/[,;]/).forEach(p => {
        const n = p.trim().replace(/\(.*?\)/, '').trim();
        if (n && n.length > 3) stakeholders.push(n);
      });
    }
    if (stakeholders.length >= 4) break;
  }

  const painFindings = findings.filter(f => f.category === 'pain_points');
  const wantFindings = findings.filter(f => f.category === 'what_acme_wants_to_see');
  const shorten = (s: string, n = 60) => s.length > n ? s.slice(0, n).replace(/\s\S*$/, '') + '…' : s;

  const auditMatch = documents.flatMap(d => (d.fullContent ?? '').match(/(\d+)[\s-]day[s]?\s+(audit|retention|log)/gi) ?? []);
  const auditDays = auditMatch.length > 0 ? (auditMatch[0].match(/\d+/)?.[0] ?? '365') : '365';

  return {
    customerName,
    stakeholders: [...new Set(stakeholders)].slice(0, 4),
    topPainPoint: painFindings[0] ? shorten(painFindings[0].title) : undefined,
    topPainDetail: painFindings[0] ? shorten(painFindings[0].statement) : undefined,
    secondPainPoint: painFindings[1] ? shorten(painFindings[1].title) : undefined,
    secondPainDetail: painFindings[1] ? shorten(painFindings[1].statement) : undefined,
    thirdPainPoint: painFindings[2] ? shorten(painFindings[2].title) : undefined,
    thirdPainDetail: painFindings[2] ? shorten(painFindings[2].statement) : undefined,
    topWant: wantFindings[0] ? shorten(wantFindings[0].title, 80) : undefined,
    docCount: documents.length,
    primaryDocName: documents[0]?.name ?? 'Customer documents',
    auditDays,
  };
}

export function buildSlides(ctx: Partial<SlideContext> = {}): Slide[] {
  const c: SlideContext = { ...DEFAULTS, ...ctx };
  const firstStakeholder = c.stakeholders[0] ?? 'your team';

  return [
    {
      id: 1,
      numberStr: '01',
      category: 'EXECUTIVE OVERVIEW',
      title: 'IBM Bob + Box Content Cloud',
      subtitle: `Tailored Demo for ${c.customerName}: ${c.topWant}`,
      notes: {
        objective: `Frame the business opportunity for ${c.customerName} by highlighting how IBM Bob and Box directly address their documented challenges.`,
        targetAudience: c.stakeholders.length > 0 ? c.stakeholders.join(', ') : 'Customer executive stakeholders',
        talkingPoints: [
          `Welcome ${firstStakeholder} and set the strategic context: today's demo is built entirely on what your team documented.`,
          'Box provides the trusted content layer, while IBM Bob transforms that context into tailored, automated execution.',
          `Today we directly address: ${c.topPainPoint}.`
        ],
        demoCue: 'Point to the IBM + Box partnership on the slide and transition into the architectural comparison.',
        objectionHandling: 'If asked how IBM Bob connects to files: Bob uses the open MCP protocol to read live Box files with zero data replication.',
        sourceCitation: c.primaryDocName,
      },
      visual: (
        <div className="h-full flex flex-col justify-between p-8 sm:p-12 bg-[#f4f7fb] text-[#161616] rounded-2xl relative overflow-hidden font-sans select-none border border-gray-200">
          <div className="absolute right-0 top-0 bottom-0 w-1/2 bg-gradient-to-l from-[#e5effb]/80 to-transparent pointer-events-none" />
          <div className="relative z-10 max-w-2xl space-y-3">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-light tracking-tight text-[#161616] leading-tight">
              IBM Bob + Box
            </h1>
            <p className="text-base sm:text-lg text-[#525252] font-light leading-relaxed">
              {c.topWant}
            </p>
          </div>
          <div className="relative z-10 my-auto py-2">
            <div className="inline-flex items-center space-x-3 bg-white/95 backdrop-blur-sm px-4 py-2.5 rounded-xl border border-blue-100 shadow-xs">
              <span className="w-5 h-5 rounded bg-[#0f62fe] flex items-center justify-center p-0.5">
                <BobLogo className="w-full h-full" />
              </span>
              <span className="text-xs font-semibold text-[#001d6c]">IBM Bob Assistant</span>
              <span className="text-gray-300 font-bold">•</span>
              <span className="text-xs font-semibold text-[#0061d5]">Box Content Cloud</span>
              <span className="text-gray-300 font-bold">•</span>
              <span className="text-xs font-mono text-gray-500">MCP Grounded</span>
            </div>
          </div>
          <div className="relative z-10 flex items-end justify-between pt-4 border-t border-gray-200/70">
            <div className="space-y-1 text-xs text-[#525252] font-light">
              <div className="font-normal text-[#161616]">Client Engineering &amp; Solutions Architecture</div>
              <div>Account: <strong className="font-medium text-[#161616]">{c.customerName}</strong></div>
              <div className="text-[11px] text-gray-400">BoxWorks Demonstration</div>
            </div>
            <div className="flex items-center text-[#161616]">
              <IbmLogo className="h-6 sm:h-7 w-auto text-[#161616]" />
            </div>
          </div>
        </div>
      )
    },
    {
      id: 2,
      numberStr: '02',
      category: 'ARCHITECTURE COMPARISON',
      title: 'Current Friction vs. Target Operating Model',
      subtitle: `Eliminating ${c.topPainPoint} and ${c.secondPainPoint}.`,
      notes: {
        objective: `Contrast ${c.customerName}'s current operational overhead against the IBM Bob + Box target model.`,
        targetAudience: 'Operations Managers, Line of Business Leads, Digital Transformation Team',
        talkingPoints: [
          `Current state: ${c.topPainPoint} — ${c.topPainDetail}`,
          `Also: ${c.secondPainPoint} — ${c.secondPainDetail}`,
          'The Box + IBM Bob target model automates intake, classification, and downstream sync — eliminating these bottlenecks entirely.'
        ],
        demoCue: 'Walk through the red legacy friction column vs. the blue IBM target state column.',
        objectionHandling: 'If asked how long deployment takes: Box connectors ingest existing repositories in place without heavy data migration.',
        sourceCitation: c.primaryDocName,
      },
      visual: (
        <div className="h-full flex flex-col justify-between p-6 sm:p-8 bg-white text-[#161616] rounded-2xl relative overflow-hidden font-sans select-none border border-gray-200">
          <div className="flex items-center justify-between pb-2.5 border-b border-gray-200 text-[11px] font-mono text-[#525252]">
            <span className="font-bold text-[#0f62fe] uppercase">02 // ARCHITECTURE TRANSFORMATION</span>
            <IbmLogo className="h-4 w-auto text-[#161616]" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-auto py-2">
            <div className="p-4 rounded-xl bg-[#fff8f8] border border-red-200 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between pb-1.5 border-b border-red-100">
                <span className="text-xs font-bold text-red-700 uppercase tracking-wide">CURRENT LEGACY FRICTION</span>
                <span className="text-[10px] font-mono bg-red-100 text-red-800 px-2 py-0.5 rounded font-semibold">High Cost</span>
              </div>
              <div className="space-y-1.5 text-xs text-[#525252]">
                <div className="p-2 rounded bg-white border border-red-100">
                  <span className="font-semibold text-[#161616] block text-[11px]">{c.topPainPoint}</span>
                  <p className="text-[10px] text-gray-600">{c.topPainDetail}</p>
                </div>
                <div className="p-2 rounded bg-white border border-red-100">
                  <span className="font-semibold text-[#161616] block text-[11px]">{c.secondPainPoint}</span>
                  <p className="text-[10px] text-gray-600">{c.secondPainDetail}</p>
                </div>
                <div className="p-2 rounded bg-white border border-red-100">
                  <span className="font-semibold text-[#161616] block text-[11px]">{c.thirdPainPoint}</span>
                  <p className="text-[10px] text-gray-600">{c.thirdPainDetail}</p>
                </div>
              </div>
            </div>
            <div className="p-4 rounded-xl bg-[#edf5ff] border border-blue-200 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between pb-1.5 border-b border-blue-100">
                <span className="text-xs font-bold text-[#0043ce] uppercase tracking-wide">IBM BOB + BOX TARGET MODEL</span>
                <span className="text-[10px] font-mono bg-blue-100 text-[#0043ce] px-2 py-0.5 rounded font-semibold">Automated</span>
              </div>
              <div className="space-y-1.5 text-xs text-[#525252]">
                <div className="p-2 rounded bg-white border border-blue-100">
                  <span className="font-semibold text-[#001d6c] block text-[11px]">Instant Box AI Taxonomy Extraction</span>
                  <p className="text-[10px] text-gray-600">Documents recognized and auto-tagged in &lt;2 seconds.</p>
                </div>
                <div className="p-2 rounded bg-white border border-blue-100">
                  <span className="font-semibold text-[#001d6c] block text-[11px]">Real-Time CRM Canvas Embed</span>
                  <p className="text-[10px] text-gray-600">Bi-directional sync with embedded document preview.</p>
                </div>
                <div className="p-2 rounded bg-white border border-blue-100">
                  <span className="font-semibold text-[#001d6c] block text-[11px]">{c.auditDays}-Day Immutable Compliance Audit</span>
                  <p className="text-[10px] text-gray-600">Centralized repository with SAML SSO and SHA-256 logs.</p>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-[11px] font-mono text-[#525252]">
            <div className="flex items-center space-x-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-[#24a148]" />
              <span>Target Impact: <strong className="text-[#001d6c]">75% Cycle Time Reduction</strong></span>
            </div>
            <span className="text-[#0f62fe] font-semibold">Zero Custom Code Required</span>
          </div>
        </div>
      )
    },
    {
      id: 3,
      numberStr: '03',
      category: 'AI DOCUMENT EXTRACTION',
      title: 'Automated Document Classification',
      subtitle: `Instant structural recognition and metadata extraction for ${c.customerName}.`,
      notes: {
        objective: `Showcase Box AI extracting mission-critical onboarding entities for ${c.customerName} without manual labeling.`,
        targetAudience: 'Operations Leads, Compliance Officers, IT Directors',
        talkingPoints: [
          `When ${c.customerName} uploads an onboarding package, Box AI instantly classifies the document type and extracts key fields.`,
          'Extraction: document type, entity names, IDs, and governance tags — in under 2 seconds, with no human labeling required.',
          'All extraction runs under enterprise zero-data-retention agreements.'
        ],
        demoCue: 'Point to the live classification confidence score and extraction speed.',
        objectionHandling: 'If asked about multi-page scans: Box AI uses semantic layout models rather than fixed pixel templates.',
        sourceCitation: c.primaryDocName,
      },
      visual: (
        <div className="h-full flex flex-col justify-between p-6 sm:p-8 bg-white text-[#161616] rounded-2xl relative overflow-hidden font-sans select-none border border-gray-200">
          <div className="flex items-center justify-between pb-2.5 border-b border-gray-200 text-[11px] font-mono text-[#525252]">
            <span className="font-bold text-[#0f62fe] uppercase">03 // INTAKE AUTOMATION ENGINE</span>
            <IbmLogo className="h-4 w-auto text-[#161616]" />
          </div>
          <div className="my-auto py-2 space-y-3">
            <div className="p-3.5 rounded-xl bg-[#edf5ff] border border-blue-200 flex items-center justify-between shadow-2xs">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-lg bg-[#0f62fe] text-white flex items-center justify-center font-bold text-xs shadow-xs">
                  <FileCheck className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-mono text-xs font-bold text-[#001d6c] block">{c.customerName.replace(/\s+/g, '_')}_Onboarding_Package.pdf</span>
                  <span className="text-[10px] text-gray-500">Box Ingestion Webhook • SHA-256 Verified</span>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded bg-[#defbe6] text-[#0e6027] font-mono text-xs font-bold border border-[#a7f0ba]">
                CLASSIFIED: 99.4%
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 rounded-lg bg-[#f8fafd] border border-gray-200 text-left shadow-2xs">
                <span className="text-[9px] font-mono text-gray-500 uppercase block mb-0.5 font-bold">Doc Taxonomy</span>
                <span className="text-xs font-bold text-[#0f62fe]">Auto-Detected</span>
              </div>
              <div className="p-3 rounded-lg bg-[#f8fafd] border border-gray-200 text-left shadow-2xs">
                <span className="text-[9px] font-mono text-gray-500 uppercase block mb-0.5 font-bold">Entity Name</span>
                <span className="text-xs font-bold text-[#161616] truncate block">{c.customerName}</span>
              </div>
              <div className="p-3 rounded-lg bg-[#f8fafd] border border-gray-200 text-left shadow-2xs">
                <span className="text-[9px] font-mono text-gray-500 uppercase block mb-0.5 font-bold">Source Files</span>
                <span className="text-xs font-bold text-[#161616] font-mono">{c.docCount} docs</span>
              </div>
              <div className="p-3 rounded-lg bg-[#f8fafd] border border-gray-200 text-left shadow-2xs">
                <span className="text-[9px] font-mono text-gray-500 uppercase block mb-0.5 font-bold">Governance Tag</span>
                <span className="text-xs font-bold text-[#8a3ffc]">Confidential</span>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-[11px] font-mono text-[#525252]">
            <span>Extraction Latency: <strong className="text-[#001d6c]">1.2s / package</strong></span>
            <span className="text-[#0f62fe] font-semibold">Box AI Document Intelligence</span>
          </div>
        </div>
      )
    },
    {
      id: 4,
      numberStr: '04',
      category: 'WORKFLOW & COMPLIANCE',
      title: 'Standardized Approval Task Routing',
      subtitle: `Automated escalation timers and ${c.auditDays}-day immutable audit logs.`,
      notes: {
        objective: `Prove compliance and governance readiness to ${c.customerName}'s security and operations stakeholders.`,
        targetAudience: 'CISO, Risk Directors, Compliance Officers',
        talkingPoints: [
          'Box Relay triggers standardized review tasks automatically upon intake validation.',
          'Built-in 24-hour escalation timer: tasks untouched re-route to secondary approvers automatically.',
          `Every approval is captured in immutable SHA-256 logs stored for ${c.auditDays} days — meeting your compliance mandate.`
        ],
        demoCue: 'Highlight the SLA timer and the tamper-evident audit log badge.',
        objectionHandling: 'If asked about staff holidays: Box Relay supports delegation rules and secondary backup assignees.',
        sourceCitation: c.primaryDocName,
      },
      visual: (
        <div className="h-full flex flex-col justify-between p-6 sm:p-8 bg-white text-[#161616] rounded-2xl relative overflow-hidden font-sans select-none border border-gray-200">
          <div className="flex items-center justify-between pb-2.5 border-b border-gray-200 text-[11px] font-mono text-[#525252]">
            <span className="font-bold text-[#0f62fe] uppercase">04 // GOVERNANCE &amp; APPROVAL WORKFLOW</span>
            <IbmLogo className="h-4 w-auto text-[#161616]" />
          </div>
          <div className="my-auto py-2 space-y-2.5">
            <div className="p-3 rounded-xl bg-[#f8fafd] border border-gray-200 flex items-center justify-between shadow-2xs">
              <div className="flex items-center space-x-3 text-xs">
                <span className="w-7 h-7 rounded-full bg-blue-100 text-[#0f62fe] font-bold text-xs flex items-center justify-center font-mono">01</span>
                <div>
                  <span className="font-bold text-[#001d6c] block text-xs">Intake Event Validated</span>
                  <span className="text-gray-500 text-[11px]">Package validated against {c.customerName} document taxonomy</span>
                </div>
              </div>
              <span className="font-mono text-[10px] text-gray-500 bg-white border border-gray-200 px-2 py-0.5 rounded font-semibold">T + 0.2s</span>
            </div>
            <div className="p-3 rounded-xl bg-white border-l-4 border-l-[#8a3ffc] border border-purple-200 flex items-center justify-between shadow-2xs">
              <div className="flex items-center space-x-3 text-xs">
                <span className="w-7 h-7 rounded-full bg-purple-100 text-[#8a3ffc] font-bold text-xs flex items-center justify-center font-mono">02</span>
                <div>
                  <span className="font-bold text-[#161616] block text-xs">Review Task Assigned</span>
                  <span className="text-gray-500 text-[11px]">{c.stakeholders[0] ?? 'Reviewer'} • 24h Escalation Timer Active</span>
                </div>
              </div>
              <span className="font-mono text-[10px] text-[#8a3ffc] font-bold bg-purple-50 px-2 py-0.5 rounded border border-purple-200">Active SLA</span>
            </div>
            <div className="p-3 rounded-xl bg-white border-l-4 border-l-[#24a148] border border-green-200 flex items-center justify-between shadow-2xs">
              <div className="flex items-center space-x-3 text-xs">
                <span className="w-7 h-7 rounded-full bg-green-100 text-[#24a148] font-bold text-xs flex items-center justify-center font-mono">03</span>
                <div>
                  <span className="font-bold text-[#161616] block text-xs">{c.auditDays}-Day Tamper-Evident Audit Record</span>
                  <span className="text-gray-500 text-[11px]">SHA-256 Log • US-East Data Center</span>
                </div>
              </div>
              <span className="font-mono text-[10px] text-[#0e6027] font-bold bg-[#defbe6] px-2 py-0.5 rounded border border-[#a7f0ba]">Compliance Verified</span>
            </div>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-[11px] font-mono text-[#525252]">
            <span>Replaces unmonitored email approval threads</span>
            <span className="font-bold text-[#0f62fe]">Box Relay Governance Engine</span>
          </div>
        </div>
      )
    },
    {
      id: 5,
      numberStr: '05',
      category: 'ENTERPRISE INTEGRATION',
      title: 'Bi-Directional CRM Sync',
      subtitle: `Zero duplicate uploads — embedded Canvas UI with real-time metadata handoff for ${c.customerName}.`,
      notes: {
        objective: `Show account executives and IT how Box seamlessly mounts inside the CRM for ${c.customerName}.`,
        targetAudience: 'Sales Operations Leads, CRM Admins, Account Executives',
        talkingPoints: [
          `Account reps never leave the CRM: Box Canvas renders directly inside the ${c.customerName} account record.`,
          'When Box approves a document, CRM account status updates automatically — no manual re-entry.',
          'Customer files stay securely in Box rather than duplicating into CRM storage.'
        ],
        demoCue: 'Point to the sync latency and the embedded Canvas interface.',
        objectionHandling: 'If asked about API rate limits: Box uses event-driven webhooks rather than polling to keep API consumption minimal.',
        sourceCitation: c.primaryDocName,
      },
      visual: (
        <div className="h-full flex flex-col justify-between p-6 sm:p-8 bg-white text-[#161616] rounded-2xl relative overflow-hidden font-sans select-none border border-gray-200">
          <div className="flex items-center justify-between pb-2.5 border-b border-gray-200 text-[11px] font-mono text-[#525252]">
            <span className="font-bold text-[#0f62fe] uppercase">05 // CRM SYNCHRONIZATION</span>
            <IbmLogo className="h-4 w-auto text-[#161616]" />
          </div>
          <div className="my-auto py-2">
            <div className="p-4 rounded-xl bg-[#edf5ff] border border-blue-200 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between text-xs pb-2 border-b border-blue-200">
                <div className="flex items-center space-x-2 text-[#001d6c] font-bold">
                  <Database className="w-4 h-4 text-[#0f62fe]" />
                  <span>CRM Account: {c.customerName}</span>
                </div>
                <span className="text-[#0e6027] font-mono font-bold text-[10px] bg-[#defbe6] px-2 py-0.5 rounded border border-[#a7f0ba]">
                  SYNCED: 142ms
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                <div className="p-3 bg-white rounded-lg border border-blue-100 shadow-2xs">
                  <span className="text-[9px] font-mono text-gray-500 block mb-0.5 uppercase font-bold">Approval State</span>
                  <span className="font-bold text-[#24a148] text-xs">Approved</span>
                </div>
                <div className="p-3 bg-white rounded-lg border border-blue-100 shadow-2xs">
                  <span className="text-[9px] font-mono text-gray-500 block mb-0.5 uppercase font-bold">Source Files</span>
                  <span className="font-bold text-[#161616] font-mono text-xs">{c.docCount} Box files</span>
                </div>
                <div className="p-3 bg-white rounded-lg border border-blue-100 shadow-2xs">
                  <span className="text-[9px] font-mono text-gray-500 block mb-0.5 uppercase font-bold">Embedded UI</span>
                  <span className="font-bold text-[#0f62fe] text-xs">Box Canvas Mounted</span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-[11px] font-mono text-[#525252]">
            <span>Direct CRM Canvas Component</span>
            <span className="text-[#0f62fe] font-bold">Zero Duplicate Uploads</span>
          </div>
        </div>
      )
    },
    {
      id: 6,
      numberStr: '06',
      category: 'SECURITY & GOVERNANCE',
      title: 'Enterprise Security, SAML SSO & Data Residency',
      subtitle: `Zero security compromises — pre-validated against ${c.customerName}'s documented mandates.`,
      notes: {
        objective: `Provide airtight technical proof for ${c.customerName}'s security team to achieve sign-off.`,
        targetAudience: 'CISO, IT Security Architects, Data Governance Leads',
        talkingPoints: [
          `Full SAML 2.0 / OpenID Connect compatibility with ${c.customerName}'s enterprise identity provider.`,
          'AES-256 at rest and TLS 1.2+ in transit with optional Customer-Managed Keys.',
          `100% of ${c.customerName} content strictly pinned to US geographic storage.`
        ],
        demoCue: 'Point to the 0 security exceptions and pre-validated architecture checklist.',
        objectionHandling: 'If asked about external auditor access: view-only watermarked permissions prevent downloads while allowing visual verification.',
        sourceCitation: c.primaryDocName,
      },
      visual: (
        <div className="h-full flex flex-col justify-between p-6 sm:p-8 bg-white text-[#161616] rounded-2xl relative overflow-hidden font-sans select-none border border-gray-200">
          <div className="flex items-center justify-between pb-2.5 border-b border-gray-200 text-[11px] font-mono text-[#525252]">
            <span className="font-bold text-[#0f62fe] uppercase">06 // SECURITY SPECIFICATIONS</span>
            <IbmLogo className="h-4 w-auto text-[#161616]" />
          </div>
          <div className="my-auto py-2 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-4 bg-[#f8fafd] rounded-xl border border-blue-100 shadow-2xs space-y-2">
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-[#0f62fe] flex items-center justify-center font-bold">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <span className="font-bold text-[#001d6c] block text-xs">SAML 2.0 / OpenID SSO</span>
              <p className="text-gray-600 text-[11px] leading-relaxed">Universal IdP support for Okta &amp; Entra ID with automated user provisioning.</p>
            </div>
            <div className="p-4 bg-[#f8fafd] rounded-xl border border-green-100 shadow-2xs space-y-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-[#24a148] flex items-center justify-center font-bold">
                <Lock className="w-4 h-4" />
              </div>
              <span className="font-bold text-[#001d6c] block text-xs">AES-256 &amp; TLS 1.2+</span>
              <p className="text-gray-600 text-[11px] leading-relaxed">End-to-end cryptography for data at rest and in transit with tamper verification.</p>
            </div>
            <div className="p-4 bg-[#f8fafd] rounded-xl border border-purple-100 shadow-2xs space-y-2">
              <div className="w-8 h-8 rounded-lg bg-purple-100 text-[#8a3ffc] flex items-center justify-center font-bold">
                <Target className="w-4 h-4" />
              </div>
              <span className="font-bold text-[#001d6c] block text-xs">US Data Residency</span>
              <p className="text-gray-600 text-[11px] leading-relaxed">All {c.customerName} content guaranteed to reside within designated US data centers.</p>
            </div>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-[11px] font-mono text-[#525252]">
            <span>Pre-Validated: <strong className="text-[#24a148]">0 Security Exceptions</strong></span>
            <span className="font-bold text-[#0f62fe]">Production Deployment Ready</span>
          </div>
        </div>
      )
    }
  ];
}

/** Backward-compatible static export (uses defaults = generic placeholder values) */
export const SLIDES: Slide[] = buildSlides();
