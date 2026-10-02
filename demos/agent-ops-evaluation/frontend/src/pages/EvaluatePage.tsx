import { useState } from 'react'
import { CheckCircle2, XCircle, ChevronDown, ChevronRight, FileSearch } from 'lucide-react'
import RunPanel from '../components/RunPanel'
import Terminal from '../components/Terminal'
import { StepList } from '../components/Steps'
import { getJSON, short, type EvalCase, type EvalResult, type Version } from '../api'
import { useStore } from '../store'

const pct = (n: number) => `${Math.round(n * 100)}%`

function CaseRow({ c }: { c: EvalCase }) {
  const [open, setOpen] = useState(false)
  const expected = new Set(c.steps.filter(s => s.kind !== 'message' && !s.reason).map(s => s.name ?? ''))
  return (
    <>
      <tr className="border-t border-ink-line hover:bg-ink-raised/60 cursor-pointer" onClick={() => setOpen(o => !o)}>
        <td className="py-2 pr-2">{open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</td>
        <td className="py-2 pr-3"><div className="font-medium">{c.applicant}</div><div className="text-xs text-ink-muted">{c.title}</div></td>
        <td className="py-2 pr-1">{c.success ? <span className="pill-green"><CheckCircle2 size={12} />pass</span> : <span className="pill-red"><XCircle size={12} />fail</span>}</td>
        <td className="py-2 pr-1 text-right text-xs">{pct(c.routing_f1)}</td>
        <td className="py-2 pr-1 text-right text-xs">{pct(c.tool_recall)}</td>
        <td className="py-2 pr-1 text-right text-xs">{pct(c.tool_precision)}</td>
        <td className="py-2 pl-2 pr-2 break-words"><span className={`font-mono text-xs ${c.actual_decision === c.expected_decision ? '' : 'text-bad'}`}>{c.actual_decision ?? '—'}</span>{c.actual_decision !== c.expected_decision && <span className="text-xs text-ink-muted"> (expected {c.expected_decision})</span>}</td>
        <td className="py-2 pl-2 text-xs">
          <div className="flex flex-col items-start gap-1">
            {(c.missed_tools ?? []).map(t => <span key={t} className="pill-red whitespace-normal text-left leading-tight break-all">missing {short(t)}</span>)}
            {(c.wrong_argument_tools ?? []).map(t => <span key={t} className="pill-yellow whitespace-normal text-left leading-tight break-all">wrong args {short(t)}</span>)}
            {c.success && <span className="text-ink-muted">{c.total_steps} steps · {c.avg_response_time_s}s avg</span>}
          </div>
        </td>
      </tr>
      {open && (
        <tr className="border-t border-ink-line bg-ink-raised/60"><td colSpan={8} className="p-3 overflow-hidden">
          <p className="text-xs text-ink-muted mb-2">Replayed conversation. Red rows were flagged; expand a row for arguments and results.</p>
          <StepList steps={c.steps} expected={expected} />
          {(c.missed_tools ?? []).map(t => <div key={t} className="border-l-2 border-bad bg-bad-soft rounded-r px-2 py-1 my-1 text-xs font-mono">expected but never called: {short(t)}</div>)}
        </td></tr>
      )}
    </>
  )
}

function EvalResultView({ r, version }: { r: EvalResult; version: Version }) {
  const [analysis, setAnalysis] = useState<string[] | null>(null)
  const [loading, setLoading] = useState(false)
  const analyze = async () => {
    setLoading(true)
    try { const a = await getJSON<{ text: string }>(`/api/results/evaluate_${version}/analyze`); setAnalysis(a.text.split('\n')) }
    catch { setAnalysis(['The analysis could not be produced.']) }
    finally { setLoading(false) }
  }
  const a = r.averages
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Stat label="Journey success" value={`${r.journey_success}/${r.total}`} tone={r.journey_success === r.total ? 'green' : 'red'} />
        <Stat label="Routing F1" value={pct(a['Orchestrate Agent Routing F1'] ?? 0)} />
        <Stat label="Tool call recall" value={pct(a['Tool Call Recall'] ?? 0)} />
        <Stat label="Tool call precision" value={pct(a['Tool Call Precision'] ?? 0)} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full table-fixed text-sm">
          <colgroup><col className="w-6" /><col className="w-[18%]" /><col className="w-14" /><col className="w-12" /><col className="w-12" /><col className="w-14" /><col className="w-[19%]" /><col /></colgroup>
          <thead><tr className="text-left text-[11px] text-ink-muted"><th></th><th>test case</th><th>journey</th><th className="text-right">routing</th><th className="text-right">recall</th><th className="text-right">precision</th><th className="pl-2">decision</th><th className="pl-2">findings</th></tr></thead>
          <tbody>{r.cases.map(c => <CaseRow key={c.id} c={c} />)}</tbody>
        </table>
      </div>
      <div>
        <button className="btn-secondary" onClick={analyze} disabled={loading}><FileSearch size={14} />{loading ? 'Analyzing…' : analysis ? 'Refresh analysis' : 'Run `evaluations analyze` on this result'}</button>
        {analysis && <div className="mt-2"><Terminal lines={analysis} maxHeight="max-h-[32rem]" /></div>}
      </div>
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'green' | 'red' }) {
  return (
    <div className="rounded border border-ink-line p-2">
      <div className="eyebrow">{label}</div>
      <div className={`text-xl font-semibold mt-0.5 ${tone === 'green' ? 'text-ok' : tone === 'red' ? 'text-bad' : 'text-ink-text'}`}>{value}</div>
    </div>
  )
}

export default function EvaluatePage() {
  const { catalog, results } = useStore()
  if (!catalog) return <p className="text-sm text-ink-muted">Loading…</p>
  return (
    <div className="space-y-4">
      <div className="card p-4 text-sm">
        <h2 className="font-semibold mb-1">Ground-truth evaluation</h2>
        <p className="text-sm font-semibold text-apricot mb-1">Why it matters: release decisions backed by numbers, and a regression suite for every prompt, tool or model change.</p>
        <p className="text-ink-muted">
          Five test cases are replayed with a simulated applicant and compared with the expected journey: agents involved, tools called with which arguments, final decision. About a minute per version.
        </p>
      </div>
      <div className="grid xl:grid-cols-2 gap-4">
        {(['v1', 'v2'] as Version[]).map(v => (
          <RunPanel key={v} kind={`evaluate_${v}`} title={catalog.versions[v].label} subtitle={catalog.versions[v].note} estimate="About 60–90 seconds for 5 test cases.">
            {results[`evaluate_${v}`] && <EvalResultView r={results[`evaluate_${v}`] as EvalResult} version={v} />}
          </RunPanel>
        ))}
      </div>
    </div>
  )
}
