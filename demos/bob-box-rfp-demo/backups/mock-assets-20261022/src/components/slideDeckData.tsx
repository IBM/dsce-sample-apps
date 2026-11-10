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

export const SLIDES: Slide[] = [
    {
      id: 1,
      numberStr: '01',
      category: 'EXECUTIVE OVERVIEW',
      title: 'IBM Bob + Box Content Cloud',
      subtitle: 'From Customer Context to Customer Demo: Commercial Onboarding Modernization for Acme Corp.',
      notes: {
        objective: 'Frame the business opportunity for Acme Corp leadership (VP Operations David Chen & IT Director Rachel Green) by highlighting how IBM Bob turns unstructured Box documents into an end-to-end commercial onboarding solution.',
        targetAudience: 'VP Operations (David Chen), IT Director (Rachel Green), Chief Risk Officer',
        talkingPoints: [
          'Welcome Acme leadership and set the strategic context: Acme processes over 450 commercial business onboarding files every month.',
          'Introduce the central message: Box provides the trusted customer context, while IBM Bob transforms that context into tailored, automated execution.',
          'Highlight that today’s demonstration directly addresses the 48-hour classification delay and CRM duplicate-entry problems documented in discovery.'
        ],
        demoCue: 'Point out the IBM + Box partnership on the slide and transition into the architectural friction comparison on Slide 02.',
        objectionHandling: 'If asked how IBM Bob connects to Acme’s files: clarify that Bob uses the open Model Context Protocol (MCP) to read live Box files with zero data replication.',
        sourceCitation: 'Acme_Discovery_Notes.docx • Demo_Request.docx • Folder: /Discovery_Notes/'
      },
      visual: (
        <div className="h-full flex flex-col justify-between p-8 sm:p-12 bg-[#f4f7fb] text-[#161616] rounded-2xl relative overflow-hidden font-sans select-none border border-gray-200">
          {/* Subtle IBM Architectural Gradient Background */}
          <div className="absolute right-0 top-0 bottom-0 w-1/2 bg-gradient-to-l from-[#e5effb]/80 to-transparent pointer-events-none" />
          
          {/* Top Title Section - IBM Watsonx Presentation Format */}
          <div className="relative z-10 max-w-2xl space-y-3">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-light tracking-tight text-[#161616] leading-tight">
              IBM Bob + Box
            </h1>
            <p className="text-base sm:text-lg text-[#525252] font-light leading-relaxed">
              Commercial Onboarding Modernization &amp; Agentic AI Orchestration
            </p>
          </div>

          {/* Center Graphic Badge Triad */}
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

          {/* Bottom Row - Presenter Metadata & Official IBM Logo in Bottom-Right */}
          <div className="relative z-10 flex items-end justify-between pt-4 border-t border-gray-200/70">
            <div className="space-y-1 text-xs text-[#525252] font-light">
              <div className="font-normal text-[#161616]">Client Engineering &amp; Solutions Architecture</div>
              <div>Account: <strong className="font-medium text-[#161616]">Acme Commercial Corp</strong></div>
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
      subtitle: 'Eliminating the 48-hour manual classification delay and dual-entry into Salesforce.',
      notes: {
        objective: 'Contrast the high operational overhead of Acme’s current legacy workflow against the quantified efficiency gains of the IBM Bob + Box architecture.',
        targetAudience: 'Operations Managers, Line of Business Leads, Digital Transformation Team',
        talkingPoints: [
          'Direct the audience to the red left column: siloed intake across 3 network drives forces 48-hour classification backlogs.',
          'Point to the blue right column: Box AI and automated Relay workflows process tax filings and extract metadata in <2 seconds.',
          'Highlight the 75% Cycle Time Reduction metric as the primary commercial business impact.'
        ],
        demoCue: 'Contrast the Red legacy friction column with the Blue IBM target state column.',
        objectionHandling: 'If asked how long deployment takes: emphasize that Box connectors ingest existing repositories in place without heavy data forklift.',
        sourceCitation: 'Acme_Discovery_Notes.docx (Sarah Jenkins) • Acme_Current_Architecture.pdf'
      },
      visual: (
        <div className="h-full flex flex-col justify-between p-6 sm:p-8 bg-white text-[#161616] rounded-2xl relative overflow-hidden font-sans select-none border border-gray-200">
          {/* Header */}
          <div className="flex items-center justify-between pb-2.5 border-b border-gray-200 text-[11px] font-mono text-[#525252]">
            <span className="font-bold text-[#0f62fe] uppercase">02 // ARCHITECTURE TRANSFORMATION</span>
            <IbmLogo className="h-4 w-auto text-[#161616]" />
          </div>

          {/* Side-by-Side 2-Column Comparative Layout */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-auto py-2">
            {/* Legacy State Card */}
            <div className="p-4 rounded-xl bg-[#fff8f8] border border-red-200 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between pb-1.5 border-b border-red-100">
                <span className="text-xs font-bold text-red-700 uppercase tracking-wide">CURRENT LEGACY FRICTION</span>
                <span className="text-[10px] font-mono bg-red-100 text-red-800 px-2 py-0.5 rounded font-semibold">High Cost</span>
              </div>
              <div className="space-y-1.5 text-xs text-[#525252]">
                <div className="p-2 rounded bg-white border border-red-100">
                  <span className="font-semibold text-[#161616] block text-[11px]">48-Hour Manual Classification</span>
                  <p className="text-[10px] text-gray-600">Staff opens and renames commercial W-9 files manually.</p>
                </div>
                <div className="p-2 rounded bg-white border border-red-100">
                  <span className="font-semibold text-[#161616] block text-[11px]">Manual CRM Re-Entry</span>
                  <p className="text-[10px] text-gray-600">Specialists lose 2–3 hours daily typing metadata into Salesforce.</p>
                </div>
                <div className="p-2 rounded bg-white border border-red-100">
                  <span className="font-semibold text-[#161616] block text-[11px]">3 Unindexed Shared Drives</span>
                  <p className="text-[10px] text-gray-600">Scattered network silos create missing files and audit risks.</p>
                </div>
              </div>
            </div>

            {/* Target Operating Model Card */}
            <div className="p-4 rounded-xl bg-[#edf5ff] border border-blue-200 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between pb-1.5 border-b border-blue-100">
                <span className="text-xs font-bold text-[#0043ce] uppercase tracking-wide">IBM BOB + BOX TARGET MODEL</span>
                <span className="text-[10px] font-mono bg-blue-100 text-[#0043ce] px-2 py-0.5 rounded font-semibold">Automated</span>
              </div>
              <div className="space-y-1.5 text-xs text-[#525252]">
                <div className="p-2 rounded bg-white border border-blue-100">
                  <span className="font-semibold text-[#001d6c] block text-[11px]">Instant Box AI Taxonomy Extraction</span>
                  <p className="text-[10px] text-gray-600">IRS Form W-9 recognized and auto-tagged in &lt;2 seconds.</p>
                </div>
                <div className="p-2 rounded bg-white border border-blue-100">
                  <span className="font-semibold text-[#001d6c] block text-[11px]">Real-Time Salesforce Canvas Embed</span>
                  <p className="text-[10px] text-gray-600">Bi-directional 142ms sync with embedded document preview.</p>
                </div>
                <div className="p-2 rounded bg-white border border-blue-100">
                  <span className="font-semibold text-[#001d6c] block text-[11px]">365-Day Immutable Compliance Audit</span>
                  <p className="text-[10px] text-gray-600">Centralized repository with SAML SSO and SHA-256 logs.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Metrics */}
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
      title: 'Automated Tax Document Classification',
      subtitle: 'Instant structural recognition of IRS Form W-9 and key commercial metadata.',
      notes: {
        objective: 'Showcase Box AI and IBM Bob extracting mission-critical commercial onboarding entities without brittle OCR templates.',
        targetAudience: 'Operations Leads, Underwriting Specialists, Compliance Officers',
        talkingPoints: [
          'Show how Acme’s standard commercial W-9 package is uploaded to Box intake via automated webhook.',
          'Highlight deterministic extraction: EIN (XX-XXX8921), Legal Entity Name, and Tax-Confidential governance flags extracted in 1.2 seconds.',
          'Reassure compliance stakeholders that extraction runs under enterprise zero-data-retention agreements.'
        ],
        demoCue: 'Point to the 99.4% classification score and 1.2s extraction speed.',
        objectionHandling: 'If asked how it handles skewed or multi-page scans: explain that Box AI uses semantic document layout models rather than fixed pixel templates.',
        sourceCitation: 'Acme_Technical_Requirements.xlsx (Row 14) • Acme_RFP.pdf • /Tech_Specs/'
      },
      visual: (
        <div className="h-full flex flex-col justify-between p-6 sm:p-8 bg-white text-[#161616] rounded-2xl relative overflow-hidden font-sans select-none border border-gray-200">
          {/* Header */}
          <div className="flex items-center justify-between pb-2.5 border-b border-gray-200 text-[11px] font-mono text-[#525252]">
            <span className="font-bold text-[#0f62fe] uppercase">03 // INTAKE AUTOMATION ENGINE</span>
            <IbmLogo className="h-4 w-auto text-[#161616]" />
          </div>

          {/* Workbench File Banner & Extraction Field Grid */}
          <div className="my-auto py-2 space-y-3">
            {/* Live Ingestion Card */}
            <div className="p-3.5 rounded-xl bg-[#edf5ff] border border-blue-200 flex items-center justify-between shadow-2xs">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-lg bg-[#0f62fe] text-white flex items-center justify-center font-bold text-xs shadow-xs">
                  <FileCheck className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-mono text-xs font-bold text-[#001d6c] block">Acme_Commercial_W9_Packet.pdf</span>
                  <span className="text-[10px] text-gray-500">Box Ingestion Webhook • 1.4 MB • SHA-256 Verified</span>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded bg-[#defbe6] text-[#0e6027] font-mono text-xs font-bold border border-[#a7f0ba]">
                CLASSIFIED: 99.4%
              </span>
            </div>

            {/* 4 Structured Extraction Tiles */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 rounded-lg bg-[#f8fafd] border border-gray-200 text-left shadow-2xs">
                <span className="text-[9px] font-mono text-gray-500 uppercase block mb-0.5 font-bold">Doc Taxonomy</span>
                <span className="text-xs font-bold text-[#0f62fe]">IRS Form W-9</span>
              </div>
              <div className="p-3 rounded-lg bg-[#f8fafd] border border-gray-200 text-left shadow-2xs">
                <span className="text-[9px] font-mono text-gray-500 uppercase block mb-0.5 font-bold">Tax ID / EIN</span>
                <span className="text-xs font-bold text-[#161616] font-mono">XX-XXX8921</span>
              </div>
              <div className="p-3 rounded-lg bg-[#f8fafd] border border-gray-200 text-left shadow-2xs">
                <span className="text-[9px] font-mono text-gray-500 uppercase block mb-0.5 font-bold">Legal Entity</span>
                <span className="text-xs font-bold text-[#161616] truncate block">Acme Commercial</span>
              </div>
              <div className="p-3 rounded-lg bg-[#f8fafd] border border-gray-200 text-left shadow-2xs">
                <span className="text-[9px] font-mono text-gray-500 uppercase block mb-0.5 font-bold">Governance Tag</span>
                <span className="text-xs font-bold text-[#8a3ffc]">Tax-Confidential</span>
              </div>
            </div>
          </div>

          {/* Footer */}
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
      title: 'Standardized Underwriting Task Routing',
      subtitle: 'Automated approval escalation timers and 365-day immutable audit logs.',
      notes: {
        objective: 'Prove compliance and governance readiness to CISO Marcus Vance and VP Operations David Chen.',
        targetAudience: 'Chief Information Security Officer, Risk Directors, Underwriting Leads',
        talkingPoints: [
          'Explain how Box Relay triggers standardized review tasks for underwriters upon intake validation.',
          'Highlight the built-in 24-hour escalation timer: tasks untouched after 24 hours re-route to secondary approvers.',
          'Demonstrate the tamper-evident audit record: every approval is captured in immutable SHA-256 logs stored in US-East for 365 days.'
        ],
        demoCue: 'Highlight the SLA timer and the 365-day tamper-evident audit log.',
        objectionHandling: 'If asked how escalation timers handle staff holidays: explain that Box Relay supports delegation rules and secondary backup assignees.',
        sourceCitation: 'Security_Requirements.pdf • Customer_Workflow_Notes.docx • /Security/'
      },
      visual: (
        <div className="h-full flex flex-col justify-between p-6 sm:p-8 bg-white text-[#161616] rounded-2xl relative overflow-hidden font-sans select-none border border-gray-200">
          {/* Header */}
          <div className="flex items-center justify-between pb-2.5 border-b border-gray-200 text-[11px] font-mono text-[#525252]">
            <span className="font-bold text-[#0f62fe] uppercase">04 // GOVERNANCE &amp; APPROVAL WORKFLOW</span>
            <IbmLogo className="h-4 w-auto text-[#161616]" />
          </div>

          {/* 3-Stage Workflow Process Flow Layout */}
          <div className="my-auto py-2 space-y-2.5">
            {/* Step 1 */}
            <div className="p-3 rounded-xl bg-[#f8fafd] border border-gray-200 flex items-center justify-between shadow-2xs">
              <div className="flex items-center space-x-3 text-xs">
                <span className="w-7 h-7 rounded-full bg-blue-100 text-[#0f62fe] font-bold text-xs flex items-center justify-center font-mono">01</span>
                <div>
                  <span className="font-bold text-[#001d6c] block text-xs">Intake Event Validated</span>
                  <span className="text-gray-500 text-[11px]">W-9 commercial package validated against Acme taxonomy</span>
                </div>
              </div>
              <span className="font-mono text-[10px] text-gray-500 bg-white border border-gray-200 px-2 py-0.5 rounded font-semibold">T + 0.2s</span>
            </div>

            {/* Step 2 */}
            <div className="p-3 rounded-xl bg-white border-l-4 border-l-[#8a3ffc] border border-purple-200 flex items-center justify-between shadow-2xs">
              <div className="flex items-center space-x-3 text-xs">
                <span className="w-7 h-7 rounded-full bg-purple-100 text-[#8a3ffc] font-bold text-xs flex items-center justify-center font-mono">02</span>
                <div>
                  <span className="font-bold text-[#161616] block text-xs">Underwriting Task Assigned</span>
                  <span className="text-gray-500 text-[11px]">Assigned to Sarah Jenkins • 24h Escalation Timer Active</span>
                </div>
              </div>
              <span className="font-mono text-[10px] text-[#8a3ffc] font-bold bg-purple-50 px-2 py-0.5 rounded border border-purple-200">Active SLA</span>
            </div>

            {/* Step 3 */}
            <div className="p-3 rounded-xl bg-white border-l-4 border-l-[#24a148] border border-green-200 flex items-center justify-between shadow-2xs">
              <div className="flex items-center space-x-3 text-xs">
                <span className="w-7 h-7 rounded-full bg-green-100 text-[#24a148] font-bold text-xs flex items-center justify-center font-mono">03</span>
                <div>
                  <span className="font-bold text-[#161616] block text-xs">365-Day Tamper-Evident Audit Record</span>
                  <span className="text-gray-500 text-[11px]">SHA-256 Log ID: AUD-LOG-9821-ACME (US-East)</span>
                </div>
              </div>
              <span className="font-mono text-[10px] text-[#0e6027] font-bold bg-[#defbe6] px-2 py-0.5 rounded border border-[#a7f0ba]">Compliance Verified</span>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-[11px] font-mono text-[#525252]">
            <span>Replaces unmonitored Outlook email threads</span>
            <span className="font-bold text-[#0f62fe]">Box Relay Governance Engine</span>
          </div>
        </div>
      )
    },
    {
      id: 5,
      numberStr: '05',
      category: 'ENTERPRISE INTEGRATION',
      title: 'Bi-Directional Salesforce Sales Cloud Sync',
      subtitle: 'Zero duplicate uploads with embedded Canvas UI and real-time metadata handoff.',
      notes: {
        objective: 'Show commercial account executives and IT how Box seamlessly mounts inside Salesforce Sales Cloud without dual-login friction.',
        targetAudience: 'Sales Operations Leads, Salesforce Admins, Account Executives',
        talkingPoints: [
          'Highlight that commercial account reps never have to leave Salesforce: Box Canvas renders directly inside Account Record ACC-99210.',
          'Show that when Box Relay approves a W-9 packet, Salesforce account status immediately flips to "Underwriting Approved" in 142ms.',
          'Emphasize that customer files remain securely stored in Box with enterprise permissions rather than bloating Salesforce file storage limits.'
        ],
        demoCue: 'Point to the 142ms sync latency and the embedded Box Canvas interface.',
        objectionHandling: 'If asked about API rate limits: explain that Box utilizes event-driven webhooks rather than polling to keep API consumption minimal.',
        sourceCitation: 'Integration_Requirements.xlsx • Acme_Technical_Requirements.xlsx • /Tech_Specs/'
      },
      visual: (
        <div className="h-full flex flex-col justify-between p-6 sm:p-8 bg-white text-[#161616] rounded-2xl relative overflow-hidden font-sans select-none border border-gray-200">
          {/* Header */}
          <div className="flex items-center justify-between pb-2.5 border-b border-gray-200 text-[11px] font-mono text-[#525252]">
            <span className="font-bold text-[#0f62fe] uppercase">05 // CRM SYNCHRONIZATION</span>
            <IbmLogo className="h-4 w-auto text-[#161616]" />
          </div>

          {/* Salesforce Canvas Component Simulator UI */}
          <div className="my-auto py-2">
            <div className="p-4 rounded-xl bg-[#edf5ff] border border-blue-200 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between text-xs pb-2 border-b border-blue-200">
                <div className="flex items-center space-x-2 text-[#001d6c] font-bold">
                  <Database className="w-4 h-4 text-[#0f62fe]" />
                  <span>Salesforce Account: Acme Commercial Corp (ID: 0015g00000XyZ12)</span>
                </div>
                <span className="text-[#0e6027] font-mono font-bold text-[10px] bg-[#defbe6] px-2 py-0.5 rounded border border-[#a7f0ba]">
                  SYNCED: 142ms
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                <div className="p-3 bg-white rounded-lg border border-blue-100 shadow-2xs">
                  <span className="text-[9px] font-mono text-gray-500 block mb-0.5 uppercase font-bold">Approval State</span>
                  <span className="font-bold text-[#24a148] text-xs">Underwriting Approved</span>
                </div>
                <div className="p-3 bg-white rounded-lg border border-blue-100 shadow-2xs">
                  <span className="text-[9px] font-mono text-gray-500 block mb-0.5 uppercase font-bold">EIN System of Record</span>
                  <span className="font-bold text-[#161616] font-mono text-xs">XX-XXX8921</span>
                </div>
                <div className="p-3 bg-white rounded-lg border border-blue-100 shadow-2xs">
                  <span className="text-[9px] font-mono text-gray-500 block mb-0.5 uppercase font-bold">Embedded UI</span>
                  <span className="font-bold text-[#0f62fe] text-xs">Box Canvas Mounted</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-[11px] font-mono text-[#525252]">
            <span>Direct Salesforce Sales Cloud Canvas Component</span>
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
      subtitle: 'Zero security compromises with AES-256, SAML SSO, and strict US Data Residency.',
      notes: {
        objective: 'Provide airtight technical proof for CISO Marcus Vance and IT Security to achieve complete technical sign-off.',
        targetAudience: 'Chief Information Security Officer (Marcus Vance), IT Security Architects, Data Governance Leads',
        talkingPoints: [
          'Confirm full SAML 2.0 / OpenID Connect compatibility with Acme’s enterprise IdP (Okta / Microsoft Entra ID).',
          'Highlight that all customer content is protected with AES-256 at rest and TLS 1.2+ in transit with optional Customer-Managed Keys (KeySafe).',
          'Verify that 100% of Acme commercial onboarding documents and audit logs are strictly pinned to US geographic storage.'
        ],
        demoCue: 'Point out the 0 security exceptions and pre-validated architecture.',
        objectionHandling: 'If Marcus asks about external third-party auditor access: showcase view-only watermarked permissions that prevent file downloads while allowing visual verification.',
        sourceCitation: 'Security_Requirements.pdf (Marcus Vance) • Data_Governance_Requirements.pdf • /Security/'
      },
      visual: (
        <div className="h-full flex flex-col justify-between p-6 sm:p-8 bg-white text-[#161616] rounded-2xl relative overflow-hidden font-sans select-none border border-gray-200">
          {/* Header */}
          <div className="flex items-center justify-between pb-2.5 border-b border-gray-200 text-[11px] font-mono text-[#525252]">
            <span className="font-bold text-[#0f62fe] uppercase">06 // SECURITY SPECIFICATIONS</span>
            <IbmLogo className="h-4 w-auto text-[#161616]" />
          </div>

          {/* 3 Security Pillars Layout */}
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
              <p className="text-gray-600 text-[11px] leading-relaxed">All commercial customer files guaranteed to reside within designated US data centers.</p>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-[11px] font-mono text-[#525252]">
            <span>Pre-Validated: <strong className="text-[#24a148]">0 Security Exceptions</strong></span>
            <span className="font-bold text-[#0f62fe]">Production Deployment Ready</span>
          </div>
        </div>
      )
    }
  ];
