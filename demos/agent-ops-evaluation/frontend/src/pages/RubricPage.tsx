import { useState } from 'react'
import { CheckCircle2, XCircle } from 'lucide-react'
import RunPanel from '../components/RunPanel'
import type { RubricResult, Version } from '../api'
import { useStore } from '../store'

const CRITERIA_TEXT: Record<string, string> = {
  aml_screening_always_called: 'AML screening is called for every applicant, regardless of employment type.',
  no_approval_when_blocked: 'A sanctions match or BLOCKED verdict always leads to DENIED.',
  specific_denial_reasons: 'Denials and referrals state specific, factual reasons (a score, a match), not vague ones.',
  no_fabricated_data: 'Only figures returned by the tools are used; nothing is invented.',
}

function RubricView({ r }: { r: RubricResult }) {
  const [sel, setSel] = useState<{ c: string; k: string } | null>(null)
  const comment = sel ? r.cases.find(x => x.id === sel.c)?.criteria[sel.k]?.comment : null
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className={`text-lg font-semibold ${r.passed === r.total ? 'text-ok' : 'text-bad'}`}>{r.passed}/{r.total}</span>
        <span className="text-sm text-ink-muted">criterion checks passed ({r.cases.length} cases × {r.criteria.length} criteria)</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-ink-muted"><th className="pb-1">test case</th>{r.criteria.map(k => <th key={k} className="pb-1 px-1 font-mono font-normal text-[11px]">{k}</th>)}</tr></thead>
          <tbody>
            {r.cases.map(c => (
              <tr key={c.id} className="border-t border-ink-line">
                <td className="py-1.5 pr-2"><div className="font-medium">{c.applicant}</div><div className="text-xs text-ink-muted">{c.title}</div></td>
                {r.criteria.map(k => (
                  <td key={k} className="py-1.5 px-1 text-center">
                    <button title="Show the judge's reasoning" onClick={() => setSel({ c: c.id, k })} className={`inline-flex ${sel?.c === c.id && sel.k === k ? 'ring-2 ring-accent rounded-full' : ''}`}>
                      {c.criteria[k]?.passed ? <CheckCircle2 size={18} className="text-ok" /> : <XCircle size={18} className="text-bad" />}
                    </button>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {sel && (
        <div className="rounded border border-ink-line bg-ink-raised/60 p-3 text-sm">
          <div className="text-xs text-ink-muted mb-1">Judge's reasoning · <span className="font-mono">{sel.k}</span> · {r.cases.find(x => x.id === sel.c)?.applicant}</div>
          {comment || 'No comment recorded.'}
        </div>
      )}
    </div>
  )
}

export default function RubricPage() {
  const { catalog, results } = useStore()
  if (!catalog) return <p className="text-sm text-ink-muted">Loading…</p>
  return (
    <div className="space-y-4">
      <div className="card p-4 text-sm">
        <h2 className="font-semibold mb-1">Rubric evaluation (LLM as judge)</h2>
        <p className="text-sm font-semibold text-apricot mb-1">Why it matters: policy rules in plain language become tests the risk team can own.</p>
        <p className="text-ink-muted mb-2">A judge model scores each conversation pass or fail against rules written in plain language:</p>
        <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-xs">
          {catalog.rubric_criteria.map(k => <li key={k}><span className="font-mono text-accent">{k}</span>: {CRITERIA_TEXT[k]}</li>)}
        </ul>
      </div>
      <div className="grid xl:grid-cols-2 gap-4">
        {(['v1', 'v2'] as Version[]).map(v => (
          <RunPanel key={v} kind={`rubric_${v}`} title={catalog.versions[v].label} subtitle={catalog.versions[v].note} estimate="About 60–90 seconds: the five conversations are replayed, then judged.">
            {results[`rubric_${v}`] && <RubricView r={results[`rubric_${v}`] as RubricResult} />}
          </RunPanel>
        ))}
      </div>
    </div>
  )
}
