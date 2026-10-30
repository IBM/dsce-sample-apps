# Agentic SOC — UI Design, Theme & Styling

**Feature**: Automated QRadar Offense Response Pipeline
**Authority**: This file is the single source of truth for the dashboard look-and-feel and for how
agent/tool output is rendered. Implementations MUST follow it verbatim. The dashboard features **dual execution modes**:
**Mock Mode** (default on UI load for customer demos where all stages run realistically without requiring an active WxO instance) and **Live Mode** (connected to watsonx Orchestrate for live agent execution), toggleable via the Navbar switch.

---

## 1. Stack & Global Rules

| Item | Value |
|---|---|
| Framework | Next.js 16 App Router, React 19, TypeScript `strict: true` |
| Styling | Tailwind CSS **v3** via PostCSS (`@tailwind base/components/utilities` — NOT `@import "tailwindcss"`) |
| Icons | `lucide-react` ^1.31.0 |
| Charts | `recharts` ^3.10.1 |
| Fonts | System font stack only — no `next/font`; `--font-sans` / `--font-mono` are never defined (Tailwind falls back to `system-ui` / `monospace`) |
| Client components | `page.tsx` and every interactive component start with `'use client';`. `layout.tsx` is a server component |
| Layout width | Full width. No `max-w-*` container anywhere on the page |
| Theme | Dark only. No light theme, no theme switch |

`layout.tsx`: exports `metadata` (title `SOC — Agentic Security Operations`), renders
`<html lang="en"><body>{children}</body></html>`, imports `./globals.css`.

---

## 2. `globals.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --background: #090d16;   --foreground: #f1f5f9;
  --card: #0f172a;         --card-foreground: #f8fafc;
  --popover: #0f172a;      --popover-foreground: #f8fafc;
  --primary: #0f62fe;      --primary-foreground: #ffffff;
  --secondary: #1e293b;    --secondary-foreground: #94a3b8;
  --muted: #1e293b;        --muted-foreground: #64748b;
  --accent: #1e293b;       --accent-foreground: #f8fafc;
  --destructive: #ef4444;  --destructive-foreground: #ffffff;
  --border: #1e293b;       --input: #1e293b;       --ring: #3b82f6;
  --radius: 0.75rem;
  --sidebar-background: #0b1120;  --sidebar-foreground: #94a3b8;
  --sidebar-primary: #0f62fe;     --sidebar-primary-foreground: #ffffff;
  --sidebar-accent: #131d31;      --sidebar-accent-foreground: #f8fafc;
  --sidebar-border: #1e293b;      --sidebar-ring: #3b82f6;
}

body {
  background-color: var(--background);
  color: var(--foreground);
  font-feature-settings: "rlig" 1, "calt" 1;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  overflow-x: hidden;
}

::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: #090d16; }
::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 9999px; }
::-webkit-scrollbar-thumb:hover { background: #334155; }

.glow-primary { box-shadow: 0 0 20px -5px rgba(15, 98, 254, 0.25); }
.glow-emerald { box-shadow: 0 0 20px -5px rgba(16, 185, 129, 0.25); }
.glow-amber   { box-shadow: 0 0 20px -5px rgba(245, 158, 11, 0.25); }
.glow-rose    { box-shadow: 0 0 20px -5px rgba(244, 63, 94, 0.25); }
.grid-background {
  background-image: radial-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px);
  background-size: 24px 24px;
}
```

`tailwind.config.js`: `darkMode: ['class']`; `content` = `src/pages|components|app/**/*.{js,ts,jsx,tsx,mdx}`;
`theme.extend.colors` maps `background, foreground, card, popover, primary, secondary, muted, accent,
destructive, border, input, ring, sidebar.*` to the `var(--…)` tokens above, plus
`security: { low:'#0284c7', medium:'#d97706', high:'#ea580c', critical:'#dc2626', success:'#16a34a' }`;
`borderRadius` lg/md/sm derive from `--radius`; keyframes/animations `pulse-subtle` (3s) and `scan-line` (8s).

### Palette (use these surfaces consistently)

| Role | Value |
|---|---|
| Page background (root div) | `#080a12` |
| Section / header surface (navbar, section wrappers, footer, chat panel) | `#0d1117` |
| Inner panel / card surface | `#0a0c16` |
| Navbar sub-bar | `#0b1120` at 80 % opacity |
| Section-header gradient | `bg-gradient-to-br from-indigo-900/80 to-indigo-800/60` |
| Primary accent | indigo (`indigo-600` buttons, `indigo-400` icons) |
| Text | `slate-100` primary, `slate-400`–`slate-600` muted |
| Borders | `slate-800/60` cards, `slate-700/60` controls |
| Stage accents | triage = indigo, classification = violet, rca = teal, notification = amber, action = rose, close = emerald, other = slate |

---

## 3. Page Shell (`app/page.tsx`)

| Element | Classes |
|---|---|
| Root `<div>` | `min-h-screen bg-[#080a12] text-slate-200 flex flex-col font-sans` |
| `<main>` | `flex-1 w-full px-4 py-6 sm:px-6 lg:px-8 space-y-6` |
| Section 1 wrapper | `space-y-3` |
| `<footer>` | `mt-12 border-t border-slate-800/60 bg-[#0d1117] py-5` |
| Footer inner | `w-full px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-600` |
| Footer texts | "SOC — Agentic Security Operations Platform" · `font-mono text-[11px] text-slate-700`: "Triage · Classification · RCA · Notification · Action · watsonx Orchestrate" |

### Render order

```
<Navbar/>
<main>
  Section 1  Hero banner + <PipelineFlow/>
  [RCA-ready banner — only when runs.rca.run.status === 'completed']
  Section 2  "Agent Execution" (collapsible): <OffenseSelector/> + horizontal row of <StageCard compact/>
             + <ActionApprovalPanel/> (only while the Action stage awaits analyst decision)
  Section 3  <AnalyticsVisualizer/>
  Section 4  <ConfigViewer/>
</main>
<ConversationalSupervisorWidget/>   renders null; injects WxO embed script (only when serviceConfigured)
<WxoChatWidget/>                    floating chat, bottom-right
[floating "View RCA Report" pill — only after RCA completed]
<IncidentReportModal/>
<footer/>
```

### Hero banner

| Element | Classes |
|---|---|
| Outer | `relative overflow-hidden rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-indigo-900/80 to-indigo-800/60 p-6 sm:p-8 shadow-lg shadow-indigo-900/50` |
| Decorative circle 1 | `pointer-events-none absolute -top-12 -right-12 h-56 w-56 rounded-full bg-white/5` |
| Decorative circle 2 | `pointer-events-none absolute -bottom-8 -left-8 h-40 w-40 rounded-full bg-indigo-500/20` |
| Content | `relative z-10 space-y-4` |
| Title row | `flex items-center justify-between gap-3` |
| `<h1>` | `text-2xl font-bold tracking-tight text-white sm:text-3xl` — "Agentic Security Operations Platform" |
| "How it works" button | `self-start inline-flex items-center gap-1.5 rounded-lg border border-white/25 bg-white/10 px-3 py-2 text-xs font-medium text-white hover:bg-white/20 transition-colors shrink-0` (`HelpCircle h-3.5 w-3.5`) |
| Sub-paragraph | `text-sm text-indigo-100 max-w-2xl` — exact text: "End-to-end incident resolution via 5-agent pipeline: Triage → Classification → RCA → Notification → Action." (no connectivity warning banner is ever rendered below it — see §14.9) |
| Mono pipeline label | `flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-mono text-indigo-200/70` — "Triage → Classification → RCA → Notification → Action · {N} Active Offenses · QRadar SIEM" |
| Guide panel | `rounded-xl border border-white/15 bg-white/10 p-4 text-xs text-indigo-100 space-y-2`, `<ol class="list-decimal list-inside space-y-1.5">`, `<strong class="text-white">` |

### RCA-ready banner

`rounded-2xl border border-teal-500/40 bg-gradient-to-r from-teal-950/90 via-slate-900 to-indigo-950/80 p-4 sm:px-6 shadow-lg shadow-teal-950/40`
with a teal "View & Download Incident Report" button (`bg-teal-600 hover:bg-teal-500 rounded-xl px-4 py-2 text-xs font-semibold text-white`).

### "Agent Execution" section

| Element | Classes |
|---|---|
| Wrapper | `rounded-2xl border border-slate-800/60 bg-[#0d1117] overflow-hidden` |
| Header | `flex items-center justify-between px-5 py-3.5 border-b border-slate-800/60 bg-gradient-to-br from-indigo-900/80 to-indigo-800/60 cursor-pointer select-none` |
| Header icon wrapper | `flex h-6 w-6 items-center justify-center rounded-md bg-indigo-500/15 text-indigo-400` (`Shield h-3.5 w-3.5`) |
| `<h2>` | `text-sm font-semibold text-slate-100 tracking-tight` — "Agent Execution" |
| Stage-count badge | `rounded-full border border-slate-700/60 bg-slate-800/60 px-2 py-0.5 text-[10px] font-mono text-slate-500` — "{N} stages" |
| Run Pipeline button | `inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 shadow-sm` (`Play h-3 w-3 fill-current`) |
| Chevron button | `flex items-center justify-center h-6 w-6 rounded-md text-indigo-300 hover:text-white transition-colors` |
| Offense selector wrapper | `px-5 pt-4 pb-4 border-b border-slate-800/60` |
| Stage cards outer | `p-5 bg-[#0a0c16]` → `w-full overflow-x-auto pb-2` → `flex items-start min-w-max` |
| Stage card wrapper | `flex-shrink-0` |
| Arrow between cards | wrapper `flex items-center px-2 pt-16 shrink-0 text-slate-700`; SVG `width="20" height="12" viewBox="0 0 20 12"` paths `M0 6 H14` and `M11 2 L18 6 L11 10` (`stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"`) |

When `mockMode = true`, a **"⚡ Pre-populate" (Zap) button** is rendered in the section header right group
for instant demo presentation walkthroughs without running progressive delays.

---

## 4. Navbar (`Navbar.tsx`)

**Props**:
```typescript
interface NavbarProps {
  mockMode: boolean;
  onToggleMockMode: (targetMode?: boolean) => void;
  serviceConfigured: boolean;
  running: boolean;
  onRunAll: () => void;
  onClear: () => void;
  statusMessage: string;
}
```

| Element | Classes |
|---|---|
| `<header>` | `sticky top-0 z-50 border-b border-slate-800/60 bg-[#0d1117] shadow-sm` |
| Main bar | `flex w-full items-center justify-between px-4 py-3 sm:px-6 lg:px-8` |
| Brand icon wrapper | `flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm` (`ShieldAlert h-5 w-5`) |
| "SOC" | `text-sm font-bold text-slate-100 tracking-tight` |
| "5-Agent" badge | `rounded-full bg-slate-800/80 px-2 py-0.5 text-[10px] font-mono text-slate-400 border border-slate-700/50` |
| Mode badge (brand area) | `mockMode`: `bg-emerald-500/15 border-emerald-500/30 text-emerald-400` (`Sparkles h-2.5 w-2.5 SIMULATION`); `live`: `bg-blue-500/15 border-blue-500/30 text-blue-400` (`Radio h-2.5 w-2.5 LIVE WXO`) |
| Sub-label | `text-[11px] text-slate-500 hidden sm:block` — "Triage · Classification · RCA · Notification · Action" |
| Right group | `flex items-center gap-2.5` |
| Segmented switch | `flex items-center rounded-lg border border-slate-700/80 bg-slate-900/90 p-0.5 text-xs` — "Mock Mode" (`Sparkles`) / "Live WxO" (`Radio`) |
| Status pill | `hidden md:flex items-center gap-2 rounded-full border border-slate-700/60 bg-slate-800/60 px-3 py-1.5 text-[11px] font-medium text-slate-400` |
| Pill — Mock Mode | emerald ping dot (`bg-emerald-400` / `bg-emerald-500`) + "Simulation Engine" |
| Pill — Live Mode (configured) | blue ping dot (`bg-blue-400` / `bg-blue-500`) + "WxO Connected" |
| Pill — Live Mode (not configured) | amber ping dot (`bg-amber-400` / `bg-amber-500`) + "WxO Disconnected" |
| Ping dot | wrapper `relative flex h-1.5 w-1.5`; outer `absolute inline-flex h-full w-full animate-ping rounded-full opacity-60`; inner `relative inline-flex h-1.5 w-1.5 rounded-full` |
| Clear button | `inline-flex items-center gap-1.5 rounded-lg border border-slate-700/60 bg-slate-800/60 px-2.5 py-1.5 text-xs font-medium text-slate-400 hover:bg-slate-700/60 hover:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors` (`Trash2`) |
| Run Pipeline button | `inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all` (`Zap` / spinning `RefreshCw`, label "Run Pipeline" / "Running…") |
| Sub-bar | `border-t border-slate-800/50 bg-[#0b1120]/80 px-4 py-1.5 text-xs text-slate-400 sm:px-6 lg:px-8` → `flex items-center justify-between gap-2` |
| Sub-bar icon | `h-3 w-3 shrink-0`: running `RefreshCw animate-spin text-indigo-400`; mock `CheckCircle2 text-emerald-400`; live configured `CheckCircle2 text-blue-400`; live not configured `AlertTriangle text-amber-400` |
| Status message | `truncate font-mono text-[11px] text-slate-300` |
| Right sub-bar | `hidden lg:flex items-center gap-3 text-[11px] text-slate-500 font-mono shrink-0` — "5 Autonomous Agents · QRadar SIEM" + when mock: `"· Simulation Engine"` (`text-emerald-400 font-semibold`) |

---

## 5. Offense Selector (`OffenseSelector.tsx`)

Reads `POC_OFFENSES` directly. Props: `{ selectedOffenseId, onSelectOffense }`.

| Element | Classes |
|---|---|
| Outer card | `w-full rounded-xl border border-slate-800/60 bg-[#0a0c16] p-4 space-y-3` |
| Row | `flex flex-col sm:flex-row sm:items-center justify-between gap-3` |
| Icon wrapper (TP) | `flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 bg-orange-500/10 text-orange-400 ring-orange-500/20` |
| Icon wrapper (Non-Issue) | same with `bg-teal-500/10 text-teal-400 ring-teal-500/20` |
| Label | `text-xs font-semibold text-slate-300 uppercase tracking-wider` — "Select Offense" |
| Title | `text-[11px] text-slate-500 truncate max-w-sm mt-0.5` |
| Dropdown wrapper | `relative w-full sm:w-[380px] shrink-0` |
| `<select>` | `w-full appearance-none rounded-lg border border-slate-700/60 bg-slate-900/60 py-2 pl-3.5 pr-9 text-xs font-medium text-slate-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-colors cursor-pointer` — options `#id — title`, sorted by numeric id |
| Stats row | `flex items-center gap-4 pt-2.5 border-t border-slate-800/60 text-[11px]`; total `font-mono text-slate-600`; TP `text-orange-400 font-medium`; Non-Issue `text-teal-400 font-medium`; close note `ml-auto text-slate-600 italic truncate max-w-xs` |

Pills share `rounded border px-1.5 py-0.5 text-[10px] font-semibold`:

| Severity | Extra | Module | Extra |
|---|---|---|---|
| Critical | `border-red-500/30 bg-red-500/10 text-red-400` | M1 | red (same pattern) |
| High | `border-orange-500/30 bg-orange-500/10 text-orange-400` | M2 | orange |
| Medium | `border-yellow-500/30 bg-yellow-500/10 text-yellow-400` | M3 / M4 | amber / yellow |
| Low | `border-sky-500/30 bg-sky-500/10 text-sky-400` | M5 / M6 / N1 | lime / green / teal |

Outcome badge: True Positive = orange + `AlertTriangle h-2.5 w-2.5`; Non-Issue = teal + `CheckCircle2 h-2.5 w-2.5`.

---

## 6. Pipeline Flow (`PipelineFlow.tsx`)

Props: `{ stageStatuses: Record<string, 'idle'|'running'|'completed'|'failed'> }` only. Five **static** nodes
(no `close` node). Header "Pipeline Architecture" / sub-label "5-Agent Sequential SOC Pipeline".

| Element | Classes |
|---|---|
| Outer | `w-full rounded-xl border border-indigo-500/30 bg-gradient-to-r from-violet-950/80 via-indigo-950/70 to-cyan-950/60 p-5` |
| Title | `text-sm font-semibold uppercase tracking-widest bg-gradient-to-r from-violet-300 via-indigo-300 to-cyan-300 bg-clip-text text-transparent` |
| Sub-label | `text-xs font-mono text-indigo-300/60` |
| Nodes row | `flex items-stretch gap-1.5 overflow-x-auto pb-1` |
| Node | `flex flex-col items-center gap-3 rounded-xl border px-4 py-5 shrink-0 flex-1 min-w-[140px] {border} {bg} {ring}` |
| Node label | `text-sm font-bold` (+ status text colour when not idle); number `text-[11px] font-mono ml-auto opacity-60` |
| Node description | `text-xs text-center space-y-1 leading-relaxed w-full opacity-80` |
| Arrow | `flex items-center shrink-0 px-1` → `h-px w-5 bg-gradient-to-r {from} {to}` + `ArrowRight h-4 w-4 text-slate-400/70` |

| Node | border | bg | text | description lines |
|---|---|---|---|---|
| 01 Triage | `border-indigo-500/40` | `bg-gradient-to-b from-indigo-900/60 to-indigo-950/50` | `text-indigo-100` | Offense metadata + type · Asset criticality · Threat intel + severity · Severity scoring (T0–T9) |
| 02 Classification | `border-violet-500/40` | `…from-violet-900/60 to-violet-950/50` | `text-violet-100` | M1–M7 detection modules · Event fetch + normalise · Adjudication + confidence · Verdict determination |
| 03 RCA | `border-teal-500/40` | `…from-teal-900/60 to-teal-950/50` | `text-teal-100` | Root cause analysis · Evidence correlation · Attack chain mapping · RCA report generation |
| 04 Notification | `border-amber-500/40` | `…from-amber-900/60 to-amber-950/50` | `text-amber-100` | Customer notification · Incident communication · Stakeholder alerting |
| 05 Action | `border-rose-500/40` | `…from-rose-900/60 to-rose-950/50` | `text-rose-100` | Remediation execution · Firewall / containment · Decision recording |

Arrow gradients: indigo→violet, violet→teal, teal→amber, amber→rose (`from-X-400/60 to-Y-400/60`).
Status ring: running `ring-2 ring-inset ring-indigo-500/30`; completed `…teal-500/30`; failed `…red-500/30`.
Status dot: idle = node colour, running `bg-indigo-400 animate-ping`, completed `bg-teal-400`, failed `bg-red-400`.
Status label colour: running `text-indigo-300`, completed `text-teal-300`, failed `text-red-300`.

---

## 7. Stage Card (`StageCard.tsx`) — agent output AND tool output

Props: `{ stage, index, stageState, onRunStage, onPromptChange, isPipelineRunning, compact?, onViewReport? }`.

### 7.1 Accent map `stageAccent(key)` → `{ ring, icon, btn, tab, border, header }`

| Stage | icon | btn | tab (active) |
|---|---|---|---|
| triage | `bg-indigo-500/15 text-indigo-400` | `bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm` | `bg-indigo-500/15 text-indigo-300 border-indigo-500/30` |
| classification | `bg-violet-500/15 text-violet-400` | `bg-violet-600 hover:bg-violet-500 …` | `bg-violet-500/15 text-violet-300 border-violet-500/30` |
| rca | `bg-teal-500/15 text-teal-400` | `bg-teal-600 hover:bg-teal-500 …` | `bg-teal-500/15 text-teal-300 border-teal-500/30` |
| notification | `bg-amber-500/15 text-amber-400` | `bg-amber-600 hover:bg-amber-500 …` | `bg-amber-500/15 text-amber-300 border-amber-500/30` |
| action | `bg-rose-500/15 text-rose-400` | `bg-rose-600 hover:bg-rose-500 …` | `bg-rose-500/15 text-rose-300 border-rose-500/30` |
| close | `bg-emerald-500/15 text-emerald-400` | `bg-emerald-600 hover:bg-emerald-500 …` | `bg-emerald-500/15 text-emerald-300 border-emerald-500/30` |
| other | `bg-slate-800/60 text-slate-400` | `bg-slate-700 hover:bg-slate-600 …` | `bg-slate-800/60 text-slate-300 border-slate-700/60` |

`ring` = `ring-{c}-500/30`; `border` = `border-{c}-500/50 ring-2 ring-{c}-500/20`; `header` = `bg-{c}-500/5 border-b border-{c}-500/15`.

### 7.2 Status badges
Base `inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium`:

| Status | Label | Classes |
|---|---|---|
| idle | Standby | `bg-slate-800/60 text-slate-400 border-slate-700/60` (`Clock`) |
| running | Executing… | `bg-indigo-500/15 text-indigo-300 border-indigo-500/30 animate-pulse` (`Activity`) |
| completed | Completed | `bg-teal-500/15 text-teal-300 border-teal-500/30` (`CheckCircle2`) |
| failed | Failed | `bg-red-500/15 text-red-400 border-red-500/30` (`AlertCircle`) |

### 7.3 Compact mode (used by `page.tsx`)

**Goal: all 5 (or 6) collapsed stage cards + their connecting arrows MUST fit within the visible viewport
width on a 1280 px screen without triggering horizontal scroll.** The card row container is
`overflow-x-auto` so it *can* scroll, but the collapsed state is the default "at-a-glance" view and
must not require scrolling on a standard laptop display.

**Width budget at 1280 px** (after `px-8` padding = 64 px each side = 1152 px usable):
- 5 stages × collapsed card width + 4 arrows × arrow wrapper width ≤ 1152 px
- Arrow wrapper is `px-2` = 16 px + SVG 20 px = ~36 px × 4 = 144 px overhead
- Available per card: (1152 − 144) / 5 = **201.6 px** → use `w-[160px]` collapsed (gives ~128 px breathing room for a 6th card when the `close` stage is present)

**Collapsed card width: `w-[160px]`** (down from the previous `w-[200px]`).
**Expanded card width: `w-[560px]`** (down from `w-[620px]`; still enough for all four tabs).

The width transition animation is unchanged: `transition: width 0.35s cubic-bezier(0.4,0,0.2,1)`.

Because the card is narrower, reduce internal padding and font sizes slightly:

| Element | Classes |
|---|---|
| Card | `relative flex flex-col rounded-xl border transition-all duration-300 bg-slate-900/60 backdrop-blur-sm shadow-sm shrink-0 {border}`; width **`w-[160px]`** collapsed / **`w-[560px]`** expanded; inline `transition: width 0.35s cubic-bezier(0.4,0,0.2,1)` |
| Border | loading `border-violet-500/50 ring-1 ring-violet-500/30`; completed `border-emerald-500/40`; failed `border-red-900/50`; idle `border-slate-800/80` |
| Header button | `flex flex-col gap-1.5 p-2.5 text-left w-full focus:outline-none group` (padding reduced from `p-3` to `p-2.5`, gap from `gap-2` to `gap-1.5`) |
| "Stage 0N" label | `font-mono text-[9px] text-slate-500` (reduced from `text-[10px]`) |
| Chevron | `h-3 w-3 text-slate-500 group-hover:text-slate-300 transition-transform duration-300` (reduced from `h-3.5 w-3.5`) |
| Number badge | `flex h-5 w-5 shrink-0 items-center justify-center rounded-md {accent.icon} font-mono text-[9px] font-semibold ring-1 {accent.ring}` (reduced from `h-6 w-6 text-[10px]`) |
| Stage label | `text-[11px] font-semibold text-slate-100 leading-tight` (reduced from `text-xs`) |
| Status badge | `inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[9px] font-medium w-fit {badge}` (reduced padding and text from `px-2 text-[10px]`) |
| Duration text | `text-[9px] font-mono text-slate-500` (reduced from `text-[10px]`) |
| Run button | `w-full inline-flex items-center justify-center gap-1 rounded-lg px-2 py-1 text-[9px] font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 {accent.btn}` (py reduced from `py-1.5`, text from `text-[10px]`) |
| Run button icon | `Play h-2 w-2 fill-current` (reduced from `h-2.5 w-2.5`) |
| RCA "Report" button | RCA card only, after completion: `w-full … px-2 py-0.5 text-[9px] font-semibold bg-teal-950/80 text-teal-300 border border-teal-500/40 hover:bg-teal-900/90` |
| Expanded panel | `border-t border-slate-800/80 overflow-hidden` |
| Instruction | `text-[10px] text-slate-300 bg-slate-950/40 p-2 rounded-lg border border-slate-800/50 leading-relaxed` (reduced from `text-[11px] p-2.5`) |
| Telemetry grid | `grid grid-cols-2 gap-1.5 bg-slate-950/60 px-3 py-1.5 border-y border-slate-800/80 text-[9px] font-mono` (gap/padding reduced) — **Thread ID**, **Run ID**, **Duration**, **Tools / Traces** |
| Tab bar | `flex flex-wrap items-center justify-between border-b border-slate-800 pb-1.5 mb-1.5 gap-1` |
| Tab button | `flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[9px] font-medium transition-colors` + `{accent.tab}` active / `text-slate-400 hover:text-slate-200 hover:bg-slate-800/50` inactive |
| Content area | `min-h-[120px] max-h-[340px] rounded-lg bg-slate-950/80 border border-slate-800/80 p-2.5 font-mono text-[11px] text-slate-200 overflow-auto` |

**Arrow between cards** (unchanged from §3): wrapper `flex items-center px-2 pt-14 shrink-0 text-slate-700`
(pt reduced from `pt-16` to `pt-14` to align with the shorter card header); SVG and paths unchanged.

**Stage count**: the deployed dashboard shows exactly **5** stage cards (Triage, Classification, RCA, Notification, Action); the Agent Execution badge reads `5 stages`. No `Stage 06 / Close` card is rendered.
Should a `close` stage ever be returned by `/api/config`, 6 × 160 px + 5 × 36 px = **1140 px** still fits within the 1152 px usable width.

Full card mode (`compact=false`): card `rounded-xl border bg-[#0a0c16] shadow-sm transition-all duration-300`
(loading `{accent.border}`, completed `border-teal-500/40`, failed `border-red-500/30`, idle `border-slate-800/60`),
header `flex flex-col gap-3 p-4 sm:p-5 {accent.header}` with "{Label} Agent" title + agent ID (mono), "Run Stage" button,
minimize toggle; telemetry row `grid grid-cols-2 gap-2 bg-slate-900/40 px-4 py-2.5 border-b border-slate-800/60 sm:grid-cols-4 text-xs font-mono`;
content area `min-h-[160px] rounded-lg bg-slate-950 p-4 font-mono text-xs text-slate-200 overflow-auto max-h-[420px]`.

### 7.4 The four tabs — REQUIRED (this is how the analyst sees tool output)

| Tab | Icon | Label | Content |
|---|---|---|---|
| Output | `FileText` | `Output` | Agent final text `run.outputText` in `<pre className="whitespace-pre-wrap leading-relaxed text-slate-200 font-sans text-[11px]">`. **Copy** button (`Copy` → `Check` + "Copied" for 2 s). While loading: `Activity h-5 w-5 animate-spin text-violet-400` + "Processing…". Empty: "Not executed yet." On the RCA card a teal callout "Incident Investigation Report Ready — Certified 5-Dimension Root Cause Analysis" + "Download Report" button |
| Tools | `Wrench` | `Tools (N)` | One card per tool call (see §7.5) |
| Traces | `Terminal` | `Traces (N)` | `JSON.stringify(run.traces, null, 2)` in `text-violet-300/90 text-[10px] leading-tight whitespace-pre-wrap`. Empty: "No traces captured." |
| Prompt | `Code2` | `Prompt` | Label "Override Prompt", `<textarea rows={4}>` bound to `stageState.prompt`, helper "Leave blank to use global prompt + previous stage outputs." |

### 7.5 Tool-call card

```
rounded-lg border border-slate-800 bg-slate-900/90 p-3 space-y-2 font-mono
├─ header   flex items-center justify-between text-xs pb-2 border-b border-slate-800/80
│           Wrench h-3.5 w-3.5 text-violet-400 + tool name (font-semibold text-violet-300)   |   "#N" chip
├─ ARGUMENTS  (label: text-[10px] uppercase font-semibold text-slate-400)
│           <pre> rounded bg-slate-950 p-2 text-[10px] text-slate-300 max-h-32 overflow-y-auto>  JSON.stringify(input, null, 2)  or "No arguments"
└─ RESPONSE   (label: text-[10px] uppercase font-semibold text-emerald-400)
            <pre> rounded bg-slate-950 p-2 text-[10px] text-emerald-300/90 max-h-48 overflow-y-auto>  JSON.stringify(output, null, 2)  or "Completed"
```
Empty state: "No tool calls captured." Loading: spinner + "Capturing tool calls…".
(Full card mode uses `text-indigo-400` for the tool icon and `text-teal-400` for the Response label.)

### 7.6 `extractToolCalls()` — MANDATORY algorithm

The Tools tab and the "Tools / Traces" counters MUST be fed from the real WxO payload, never from fabricated data.

1. Search targets (skip falsy): `run.raw`, `run.raw.result`, `run.raw.result.data`, `run.raw.result.data.message`, and every item of `run.traces[]`.
2. For each target take `step_history = target.step_history || target.message?.step_history || (Array.isArray(target) ? target : null)`.
3. For each `step` take `step_details = step.step_details || step.delta?.step_details || (step.type ? [step] : null)`.
4. For each `detail`:
   - `type === 'tool_calls'` → for each `tc` in `detail.tool_calls`: key `tc.id || tc.tool_call_id || tc.name`; create `{ id, name: tc.name || 'Tool Call', input: tc.args || tc.input || tc.arguments, output: null }` or back-fill a missing `input`.
   - `type === 'tool_response'` with `tool_call_id` → parse `detail.content` as JSON when it is a string starting with `{` or `[` (else keep text); set/merge `output`; adopt `detail.name` if the existing name is `'Tool Call'`.
   - `type === 'tool_call'` with `tool_call_id` → create/merge with `input = detail.args || detail.input`.
5. De-duplicate by that key in a `Map`; return values in insertion order.

---

## 8. Analytics Visualizer (`AnalyticsVisualizer.tsx`)

Props: `{ stages, runs, selectedOffenseId?, open?, onToggle? }`. Uses `recharts`.

| Element | Classes |
|---|---|
| Outer | `rounded-xl border border-slate-800/60 bg-[#080a12] overflow-hidden space-y-0` |
| Header | `flex items-center justify-between px-5 py-3.5 border-b border-slate-800/60 bg-gradient-to-br from-indigo-900/80 to-indigo-800/60 cursor-pointer select-none` — icon `ShieldAlert h-3.5 w-3.5 text-indigo-400` in `h-6 w-6 rounded-md bg-indigo-500/15 ring-1 ring-indigo-500/25`; title "Pipeline Analytics" + `<span class="text-indigo-200/50 font-normal">& Agent Telemetry</span>`; right label "watsonx Orchestrate" (`text-[11px] font-mono text-indigo-200/50`) |
| Body | `p-5 space-y-5` |
| Outcome banner | `flex items-center gap-3 rounded-lg border p-3 text-xs` — TP `border-orange-500/25 bg-orange-500/5 text-orange-300`; Non-Issue `border-cyan-500/25 bg-cyan-500/5 text-cyan-300`; close note `ml-2 text-slate-500 italic` |
| KPI grid | `grid grid-cols-2 gap-3 sm:grid-cols-4`; card `rounded-lg border border-slate-800/50 bg-[#0a0c16] p-3.5`; value `text-lg font-bold text-white font-mono` |
| KPI cards | **Total Execution Time** (`Clock`, indigo) · **Tool Invocations** (`Wrench`, indigo) · **Traces Captured** (`FileCode`, cyan) · **Stages Completed** `N / total` (`CheckCircle2`, cyan) |
| Charts grid | `grid grid-cols-1 gap-5 lg:grid-cols-3`; bar panel `lg:col-span-2 rounded-lg border border-slate-800/50 bg-[#0a0c16] p-4` (`h-44`); pie panel same without col-span (`h-36`, donut `innerRadius={30} outerRadius={55} paddingAngle={3}`) |
| Tooltip | `contentStyle { backgroundColor:'#0a0c16', borderColor:'#1e2a3a', borderRadius:'8px', color:'#f1f5f9', fontSize:'12px' }`, `itemStyle { color:'#67e8f9' }` |

Stage colours: `triage #6366f1`, `classification #8b5cf6`, `rca #14b8a6`, `notification #f59e0b`, `action #f43f5e`, `close #10b981`; non-completed bar fill `#1a1f2e`.
**Tool Invocations** = unique tool calls across all stages, using the same de-duplication as §7.6 (`countUniqueToolCalls`).

---

## 9. Config Viewer (`ConfigViewer.tsx`)

Props `{ open, onToggle }`. On first open calls `GET /api/config-files` → `{ files: ConfigFile[] }`.

| Element | Classes |
|---|---|
| Wrapper / header | same as "Agent Execution" section; title "Agent & Config Files"; count badge; hint "Agent instructions & config" (`hidden sm:block text-[11px] font-mono text-indigo-200/50`) |
| Body | `flex` with inline `minHeight: 480px; maxHeight: 70vh` |
| Sidebar | `w-56 shrink-0 border-r border-slate-800/60 bg-[#0a0c16] overflow-y-auto`; group header `px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-600 select-none` (groups `Agents`, `Config`) |
| File button | active `w-full flex items-center gap-2 px-3 py-2 text-left text-xs bg-indigo-600/20 text-indigo-300 border-r-2 border-indigo-500`; inactive `… text-slate-400 hover:bg-slate-800/60 hover:text-slate-200` |
| Right pane | `flex-1 overflow-hidden flex flex-col bg-[#080a12]`; breadcrumb `flex items-center gap-2 px-4 py-2.5 border-b border-slate-800/60 bg-[#0a0c16]`; content `<pre class="text-[11px] font-mono text-slate-300 leading-relaxed whitespace-pre p-4 min-w-0">` |

File manifest: see `contracts/api-contracts.md` §2 `GET /api/config-files`.

---

## 10. Action Approval Panel (`ActionApprovalPanel.tsx`)

Inline (not a modal overlay) panel rendered inside the Agent Execution section while the Action stage waits
for the analyst. Props: `{ offense, isOpen, onAllDecided(items), onViewRcaReport? }`.

| Element | Classes |
|---|---|
| Panel | `rounded-2xl border-2 border-amber-400/90 bg-[#0c101a] p-5 sm:p-6 shadow-2xl shadow-amber-950/40 space-y-5` |
| Title | "Action Approval Required" `text-base sm:text-lg font-bold text-amber-300` + "(N pending review)" `text-xs font-mono text-amber-400/80`; `Lock` icon in `bg-amber-400/20 text-amber-300` |
| "Approve All Actions" | `rounded-lg bg-[#28a745] hover:bg-[#218838] px-3.5 py-1.5 text-xs font-bold text-white shadow-md active:scale-95` |
| Action card | `rounded-xl border-2 overflow-hidden` — pending `border-amber-400/80 bg-slate-900/80`; approved `border-emerald-500/60 bg-emerald-950/20`; rejected `border-red-500/60 bg-red-950/20 opacity-80` |
| Severity pill | `rounded-full px-3 py-0.5 text-[11px] font-bold uppercase` — HIGH `bg-[#dc3545]`, MEDIUM `bg-[#fd7e14]`, LOW `bg-[#17a2b8]` (white text) |
| Fields | rows "Action ID:", "Target:", "Reasoning:" (`grid grid-cols-[100px_1fr] sm:grid-cols-[120px_1fr] text-xs font-mono`) |

True-Positive offenses propose `block_ip_address` (HIGH), `disable_user_account` (HIGH), `isolate_device` (MEDIUM);
Non-Issue offenses propose a single `close_offense_ticket` (LOW). When every item is decided (or "Approve All"),
`onAllDecided(items)` resolves the pending `actionApprovalResolverRef` promise in `page.tsx`.

**Required flow (Mock Mode Only):** When `runStage('action')` is invoked in Mock Mode, it sets `actionApprovalOpen = true`, and the status bar shows
`[Action] Action Approval Required — Waiting for analyst review…`. It awaits analyst adjudication, closes the panel, and synthesizes the simulated remediation result with the analyst decisions recorded in the adjudication summary and duration set to 5.0s.
In **Live Mode**, the Action Approval Panel is strictly omitted; `runStage('action')` immediately submits the prompt to the live watsonx Orchestrate Action agent without UI modal gating.
The panel itself calls no API.

---

## 11. Incident Report Modal (`IncidentReportModal.tsx`)

Props `{ isOpen, onClose, offense, runs }`. Overlay `fixed inset-0 z-50 … bg-black/80 backdrop-blur-sm`; dialog
`w-full max-w-5xl h-[90vh] rounded-2xl border border-slate-700/80 bg-[#0d1117] shadow-2xl shadow-indigo-950/80`;
header gradient `from-indigo-950/90 to-slate-900`, title "Incident Investigation Report", pills "Offense #{id}" and
"RCA Certified". Tabs: **Preview** (sandboxed iframe titled "Incident Report Preview") and **Markdown Source**
(with "Copy Markdown"). Actions: Download HTML (`Incident_Report_Offense_{id}.html`), Download Markdown
(`Incident_Report_Offense_{id}.md`), Print / PDF. Content is generated **only** from the real stage outputs in `runs`.
Props additionally include `mockMode: boolean`. In **Live mode** the content is built by parsing `runs.<stage>.run.outputText`
per [`data-model.md`](./data-model.md) §3.7–§3.8 (see `plan.md` §4.5): rows and sections whose value is absent
(`N/A`, `unknown`, `none`, empty) are **omitted** — the literal text "N/A" / "Unknown" is never shown as a value — and no static
offense data or placeholder IPs are used. In Mock mode the existing static/mock generation applies.
The pill "RCA Certified" is shown only when the RCA `Determination` / `Classification` is present; otherwise it is hidden.

---

## 12. Chat Widgets

**`ConversationalSupervisorWidget.tsx`** — renders `null`; injects the WxO embed script (`wxOConfiguration` + `wxoLoader`).
Only mounted when `serviceConfigured` is true.

**`WxoChatWidget.tsx`** — chat widget supporting both Mock Mode simulation and live polling chat against `/api/chat-conv`. Props: `{ selectedOffenseId?, mockMode?: boolean }`.

| Element | Classes |
|---|---|
| Toggle button | `fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg shadow-indigo-900/60 transition-all duration-200`; open `bg-slate-800 border border-slate-700 hover:bg-slate-700`; closed `bg-indigo-600 hover:bg-indigo-500 border border-indigo-400/40`; unread badge `absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-red-500 text-[9px] font-bold text-white` |
| Panel | `fixed bottom-24 right-6 z-50 flex flex-col w-[360px] sm:w-[420px] max-h-[600px] rounded-2xl border border-slate-700/60 bg-[#0d1117] shadow-2xl shadow-indigo-950/70 transition-all duration-200 origin-bottom-right`; visible `scale-100 opacity-100`, hidden `scale-95 opacity-0 pointer-events-none` |
| Header | `rounded-t-2xl border-b border-slate-800/70 bg-gradient-to-r from-indigo-950/90 to-violet-950/80 px-4 py-3` — "Conversational Supervisor" / "watsonx Orchestrate · SOC" |
| User bubble | `max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm bg-indigo-600 text-white rounded-tr-sm` |
| Assistant bubble | `max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm bg-slate-800/80 border border-slate-700/50 text-slate-200 rounded-tl-sm`, `whitespace-pre-wrap break-words` |
| Error bubble | `bg-red-900/30 border border-red-700/40 text-red-300 rounded-tl-sm` |
| Input bar | `border-t border-slate-800/70 bg-[#0a0c16] rounded-b-2xl px-3 py-3`; textarea `rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2.5 text-sm focus:border-indigo-500/60`; send `h-9 w-9 rounded-xl bg-indigo-600 hover:bg-indigo-500` |

Polling: `POST /api/chat-conv` → poll `GET /api/chat-conv/{runId}` every 3 000 ms (cap 360 000 ms); reads
`pollData.outputText` and `pollData.analytics.durationMs` at the **top level**.

---

## 13. Page Behaviour That Shapes the UI

- `runStage` operates according to the active mode:
  - **In Mock Mode (default on load)**: Executes simulated agent reasoning and security tool evaluation over ~5.0s per stage via `buildMockRunDetails`, displaying progressive status messages without calling external WxO endpoints. All 5 stages (Triage → Classification → RCA → Notification → Action) run seamlessly for customer demonstrations.
  - **In Live Mode (WxO connected)**: `POST /api/poc-stages/{stageKey}/run` → poll every **4 000 ms**, deadline **360 000 ms**. Status-bar messages: `[Label] Submitting prompt to watsonx Orchestrate…`, `[Label] Run created (xxxxxxxx…) — agent is processing…`, `[Label] Agent running… status: {status} · {n}s elapsed (poll #k)`, `[Label] Completed in {s}s — status: {status}`.
- Poll responses in Live mode with `retryable: true` show `[Label] Status check timed out — retrying… · {n}s elapsed` and continue.
- A failed stage stores `{ loading:false, error: error.message }` in `runs` and (single-stage run) shows `[Label] Error: {message}` in the Navbar status bar; `Run Pipeline` continues with the next stage.
- Stage outputs live in React state (`runs`, `runsRef`) and reset on refresh or Clear. Mode selection (`mockMode`) is persisted in `localStorage('soc_mock_mode')` and defaults to `true`.
- `Run Pipeline` iterates the stages returned by `/api/config` (fallback: the 5 defaults) sequentially, chaining prompts via `buildPromptForStage`.

---

## 14. Mock Mode vs Live WxO Mode — Complete UI & Behaviour Mapping

> **Ground truth**: The actual `page.tsx` has `const [mockMode, setMockMode] = useState<boolean>(true)`
> persisted in `localStorage('soc_mock_mode')`. `Navbar.tsx` has a **segmented switch** ("Mock Mode" /
> "Live WxO") that calls `handleToggleMockMode(true|false)`. This section maps every UI surface and
> runtime behaviour that changes between the two modes.

---

### 14.1 State

```typescript
const [mockMode, setMockMode] = useState<boolean>(true);
// persisted in localStorage.getItem('soc_mock_mode')
```

**Initialisation** (inside `useEffect → fetchConfig()`):
- Restore from `localStorage.getItem('soc_mock_mode')` first.
- If `/api/config` returns `serviceConfigured = false` → force `mockMode = true`, write to `localStorage`, set status `'⚡ Self-Contained Simulation Engine Active.'`.
- If `/api/config` throws (backend unreachable) → force `mockMode = true`, set status `'⚡ Self-Contained Simulation Engine Active.'`.
- If `serviceConfigured = true` and `mockMode` (from localStorage) is already `false` → set status `'watsonx Orchestrate agent endpoints connected.'`.

**Toggle handler** `handleToggleMockMode(targetMode?: boolean)`:
- Flips or sets `mockMode`, writes to `localStorage`.
- Mock → status `'⚡ Simulation Mode Active — Running end-to-end WxO multi-agent pipeline.'`
- Live + configured → status `'Live watsonx Orchestrate endpoint execution active.'`
- Live + not configured → status `'⚠️ Live mode selected, but WxO credentials not configured in .env. Simulation mode is recommended.'`

---

### 14.2 Navbar — Mode Toggle Switch & Indicators

The Navbar contains a **segmented pill switch** (the primary mode control) plus a status pill that
reflects the current mode.

**Segmented switch** (right group, leftmost element):

```
div  flex items-center rounded-lg border border-slate-700/80 bg-slate-900/90 p-0.5 text-xs
├── button  "Mock Mode"    Sparkles h-3 w-3    active: bg-emerald-600 text-white shadow-sm
│                                               inactive: text-slate-400 hover:text-slate-200 hover:bg-slate-800/60
│                                               disabled when running
└── button  "Live WxO"    Radio h-3 w-3        active: bg-indigo-600 text-white shadow-sm
                                                inactive: text-slate-400 hover:text-slate200 hover:bg-slate-800/60
                                                disabled when running; title warns if !serviceConfigured
```

**Mode badge in brand area** (left side of Navbar, next to "5-Agent" badge):

| `mockMode` | Classes | Icon | Label |
|---|---|---|---|
| `true` | `bg-emerald-500/15 border-emerald-500/30 text-emerald-400` | `Sparkles h-2.5 w-2.5` | `SIMULATION` |
| `false` | `bg-blue-500/15 border-blue-500/30 text-blue-400` | `Radio h-2.5 w-2.5` | `LIVE WXO` |

**Connection status pill** (right group, `hidden md:flex`):

| `mockMode` | `serviceConfigured` | Dot | Label |
|---|---|---|---|
| `true` | any | emerald (`bg-emerald-400`/`bg-emerald-500`) | `Simulation Engine` |
| `false` | `true` | blue (`bg-blue-400`/`bg-blue-500`) | `WxO Connected` |
| `false` | `false` | amber (`bg-amber-400`/`bg-amber-500`) | `WxO Disconnected` |

**Sub-bar icon** (left side):

| Condition | Icon + class |
|---|---|
| `running` | `RefreshCw animate-spin text-indigo-400` |
| `!running && mockMode` | `CheckCircle2 text-emerald-400` |
| `!running && !mockMode && serviceConfigured` | `CheckCircle2 text-blue-400` |
| `!running && !mockMode && !serviceConfigured` | `AlertTriangle text-amber-400` |

**Sub-bar right side** (hidden below `lg`): `"5 Autonomous Agents · QRadar SIEM"` + when `mockMode`:
`"· Simulation Engine"` (`text-emerald-400 font-semibold`).

---

### 14.3 Hero Banner — Mode Indicator

Inside the mono pipeline label row (below the sub-paragraph), append when `mockMode = true`:

```
· <span class="text-emerald-300 font-semibold">⚡ High-Fidelity Simulation Mode</span>
```

This span is **not rendered** when `mockMode = false`.

---

### 14.4 Agent Execution Section Header

When `mockMode = true`, a **"⚡ Pre-populate" (Zap) button** appears in the section header right group
(between the status elements and Run Pipeline button):

```typescript
// Only rendered when mockMode
<button
  onClick={handleLoadMockResults}
  disabled={running}
  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-950/40
             px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-900/50
             disabled:opacity-40 transition-all active:scale-95 shadow-sm"
  title="Instantly pre-populate all stage responses for this offense"
>
  <Zap className="h-3 w-3" />
  {/* label intentionally empty in the current build */}
</button>
```

`handleLoadMockResults()`: calls `buildMockRunDetails(stage.key, offenseId, startedAt)` for every
stage in sequence, populating `runs` instantly without any network calls or delays. Sets status:
`"⚡ Telemetry & outputs populated for Offense #{id}. Report ready!"`.

This button is **not rendered** when `mockMode = false`.

---

### 14.5 `runStage()` — Dual Code Path

The single `runStage` function branches internally:

#### Mock path (`mockMode = true`)

1. Sets `loading: true` for the stage.
2. **Action stage only**: sets `actionApprovalOpen = true`, awaits `actionApprovalResolverRef` promise
   (user clicks Approve/Reject in `ActionApprovalPanel`). After resolution: two 2.5s status delays,
   builds mock run with custom `outputText` containing the adjudication summary, duration forced to 5000ms.
3. **All other stages**: three sequential `setTimeout` delays (1650ms + 1700ms + 1650ms = ~5s total)
   with progressive status messages:
   - `[{Label}] Initiating agent reasoning & fetching offense #{id} telemetry…`
   - `[{Label}] Executing security tools & evaluating baseline policies…`
   - `[{Label}] Synthesizing findings and generating structured report…`
4. Calls `buildMockRunDetails(stageKey, offenseId, startedAt)` → `run` object with realistic telemetry
   (tool calls, traces, outputText, analytics).
5. Forces `analytics.durationMs = 5000`.
6. If `!preserveStatusBanner`: sets `[{Label}] Completed in 5.0s — status: completed`.
7. Returns updated runs map (no network calls, no polling).

#### Live path (`mockMode = false`)

1. Sets `loading: true`.
2. Sets status `[{Label}] Submitting prompt to watsonx Orchestrate…`.
3. `POST /api/poc-stages/{stageKey}/run` body `{ prompt }` → checks `!postRes.ok || !postPayload.success`.
4. Extracts `{ runId, threadId, startedAt }`, sets status `[{Label}] Run created ({runId[:8]}…) — agent is processing…`.
5. Poll loop every 4000ms until 360000ms deadline:
   - `retryable: true` → logs retry message, continues.
   - `!completed` → logs elapsed + status, continues.
   - `completed` → stores `pollPayload.run`, sets completion status, returns.
6. On error → stores `{ loading: false, error }`, re-throws.

#### Status messages comparison

| Event | Mock | Live |
|---|---|---|
| Pipeline start | `⚡ Initiating SOC 5-Agent Pipeline — Triage → Action…` | same |
| Per-stage start | `Executing {Label} Agent for Offense #{id}…` | same |
| Stage init | `[{Label}] Initiating agent reasoning…` | `[{Label}] Submitting prompt to watsonx Orchestrate…` |
| Stage mid-exec | `[{Label}] Executing security tools…` / `…Synthesizing findings…` | `[{Label}] Agent running… status: {status} · {n}s (poll #{k})` |
| Stage complete | `[{Label}] Completed in 5.0s — status: completed` | `[{Label}] Completed in {actual}s — status: {status}` |
| Stage error | `[{Label}] Error: {message}` | same |
| Poll timeout-retry | *(not applicable)* | `[{Label}] Status check timed out — retrying… · {n}s elapsed` |
| Pipeline done | `Pipeline completed successfully. Remediation actions adjudicated and verified.` | same |

---

### 14.6 `runAllStages()` — Mock-specific Inter-Stage Delay

```typescript
if (mockMode && stage.key !== 'action') {
  await new Promise((r) => setTimeout(r, 300));
}
```

A 300ms breathing pause is added **between stages in mock mode only** (not for the Action stage since
it already has its own approval wait). This is omitted in live mode because the POST+poll already
provides natural inter-stage spacing.

---

### 14.7 `WxoChatWidget.tsx` — Mock vs Live

The `WxoChatWidget` receives `mockMode` as a prop:

```typescript
interface WxoChatWidgetProps {
  mockMode: boolean;
  selectedOffenseId?: string;
}
```

| Feature | `mockMode = true` | `mockMode = false` |
|---|---|---|
| Chat API path | Still uses `/api/chat-conv` (the mock server responds) | Same endpoint, hits live Express |
| Offline fallback | The widget currently has **no offline/mock reply path** — it calls `/api/chat-conv` in both modes | Same |
| Floating button label/style | No change | No change |

> **Note**: `ConversationalSupervisorWidget` (the WxO embed loader) is mounted only when
> `!mockMode && serviceConfigured` — i.e. the WxO iframe chat is **only injected in live mode with
> configured credentials**. In mock mode, only `WxoChatWidget` (the custom polling chat) is visible.

---

### 14.8 Complete Surface-by-Surface Diff

| Surface | Mock Mode (`mockMode = true`) | Live WxO Mode (`mockMode = false`) |
|---|---|---|
| Navbar brand badge | Emerald `Sparkles` · `SIMULATION` | Blue `Radio` · `LIVE WXO` |
| Navbar segmented switch | "Mock Mode" pill active (emerald) | "Live WxO" pill active (indigo) |
| Navbar connection pill | Emerald dot · `"Simulation Engine"` | Blue dot `"WxO Connected"` / Amber `"WxO Disconnected"` |
| Navbar sub-bar icon | `CheckCircle2 text-emerald-400` | `CheckCircle2 text-blue-400` / `AlertTriangle text-amber-400` |
| Navbar sub-bar right | `"Simulation Engine"` (emerald) appended | Not appended |
| Hero banner pipeline label | `⚡ High-Fidelity Simulation Mode` appended | Not appended |
| Hero banner initial status | `"⚡ Simulation Mode Active…"` | `"watsonx Orchestrate agent endpoints connected."` or warning |
| Agent Execution header | `⚡` Zap pre-populate button visible | Zap button hidden |
| `runStage` execution | 3-phase delay (~5s), `buildMockRunDetails`, no network | POST + poll every 4000ms, real WxO response |
| Action stage gating | `ActionApprovalPanel` opens, blocks execution | **Omitted** (runs directly against live WxO endpoint) |
| RCA report triggers / Modal | `IncidentReportModal`, banner, card buttons — content from mock data | **Shown** once RCA (or Classification) output exists — content built only from parsed `outputText` (FR-08) |
| Stage output source | `buildMockRunDetails` (deterministic, rich telemetry) | Real WxO agent `pollPayload.run` |
| Stage duration shown | Always `5.0s` | Actual WxO execution time |
| Tool calls shown | Synthetic tool calls from `mockPipelineData.ts` | Real tool calls from WxO traces |
| `ConversationalSupervisorWidget` | **Not mounted** | Mounted (if `serviceConfigured`) |
| `WxoChatWidget` prop | `mockMode={true}` | `mockMode={false}` |
| localStorage | `soc_mock_mode = 'true'` | `soc_mock_mode = 'false'` |

---

### 14.9 Forbidden "WxO not connected" UI (deployed-parity rule)

The deployed app (`agentic-soc-frontend` on Code Engine) never blocks or warns about a missing WxO instance on load. The following MUST NOT exist anywhere in the UI:

| Forbidden element | Seen in (non-conforming build) |
|---|---|
| Navbar pill `WxO disconnected (demo)` with red dot | Navbar right group |
| Navbar button `WxO Off` (red, `WifiOff` icon) | Navbar right group |
| Disabled / dimmed `Run Pipeline` buttons driven by connectivity | Navbar + Agent Execution header |
| Sub-bar text `WxO instance disconnected — pipeline will not run.` | Navbar sub-bar |
| Hero banner `WxO instance not connected. Stage runs will fail immediately. Toggle WxO Live in the navbar…` | Below hero mono label |
| 6th `Stage 06 — Close` card / `6 stages` badge | Agent Execution |

Required instead (initial load, no credentials, no `localStorage`):

| Surface | Value |
|---|---|
| Navbar badge | `SIMULATION` (emerald) |
| Segmented switch | `Mock Mode` active |
| Pill | `Simulation Engine` (emerald) |
| Sub-bar message | `⚡ Simulation Mode Active — Running end-to-end WxO multi-agent pipeline.` (then `⚡ Self-Contained Simulation Engine Active.` once `/api/config` reports `serviceConfigured = false`) |
| Sub-bar right | `5 Autonomous Agents · QRadar SIEM · Simulation Engine` |
| Hero mono label | `Triage → Classification → RCA → Notification → Action · {N} Active Offenses · QRadar SIEM · ⚡ High-Fidelity Simulation Mode` |
| Offense selector | Offense `#167657` (High · M1 · True Positive — `INT: Web Exploit Detection — Path traversal, alert_status=passed`) preselected; dropdown contains a `— Select an Offense —` placeholder + 25 offenses; footer `25 offenses loaded · 8 True Positive · 17 Non-Issue` |
| Run buttons | Enabled; Agent Execution badge `5 stages`; stage cards show `Standby` |
| Analytics | `Stages Completed 0 / 5` |

---

## 15. Dual Execution Modes Guarantee (Mock Demo & Live WxO)

The application architecture establishes that **both Mock Mode and Live Mode work fully and seamlessly**:

1. **Mock Mode (Default Demo Mode)**:
   - Active by default when the application loads.
   - Designed to run **seamlessly without requiring a connected watsonx Orchestrate (WxO) instance**.
   - Runs all 5 pipeline stages (Triage → Classification → RCA → Notification → Action) with realistic agent reasoning delays (~5s), progressive telemetry updates, synthetic tool call inspection, HITL action adjudication, and incident report generation.
   - Guarantees 100% functional demo execution for customer presentations and offline environments without errors or disabled controls.

2. **Live WxO Mode**:
   - Toggled via the Navbar segmented switch (**"Live WxO"**).
   - Connects directly to the live watsonx Orchestrate instance and runs all autonomous agents in real time via the backend proxy.
   - **Scope**: Omits only the client-side Action Approval gating. The RCA Incident Report modal/export triggers remain available (US-05) and generate the report solely from the real stage outputs (FR-08).
   - If WxO credentials are not configured in `.env` when Live Mode is selected, the Navbar displays a warning indicator suggesting Mock Mode, while Mock Mode remains immediately available for full seamless execution.
