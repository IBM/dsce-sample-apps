import { useEffect, useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { ArrowRightLeft, Wrench, Cpu, Clock, Coins, Play } from 'lucide-react'
import { ApiError, getJSON, readSSE, short, type Scenario, type Version } from '../api'
import { useStore } from '../store'

interface LiveStep { kind: 'agent' | 'tool_call' | 'tool_response'; agent?: string; name?: string; args?: unknown; content?: unknown; handoff?: boolean; t: number }
interface Usage { total: number | null; models: { model: string; prompt_tokens: number; completion_tokens: number; total_tokens: number }[] }
interface Trace { spans: { kind: string; name: string; latency_ms: number | null; input_tokens: number; output_tokens: number }[]; tokens_by_model: Record<string, { input: number; output: number; calls: number }>; latency_ms: number }

export default function RunPage() {
  const { catalog } = useStore()
  const [version, setVersion] = useState<Version>('v1')
  const [scenario, setScenario] = useState<Scenario | null>(null)
  const [running, setRunning] = useState(false)
  const [text, setText] = useState('')
  const [steps, setSteps] = useState<LiveStep[]>([])
  const [usage, setUsage] = useState<Usage | null>(null)
  const [elapsed, setElapsed] = useState<number | null>(null)
  const [traceId, setTraceId] = useState<string | null>(null)
  const [trace, setTrace] = useState<Trace | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [traceError, setTraceError] = useState<string | null>(null)
  const [traceReadyIn, setTraceReadyIn] = useState(0)
  useEffect(() => {
    if (!traceId) return
    setTraceReadyIn(15)
    const id = setInterval(() => setTraceReadyIn(n => { if (n <= 1) { clearInterval(id); return 0 } return n - 1 }), 1000)
    return () => clearInterval(id)
  }, [traceId])

  const run = async (s: Scenario, v: Version) => {
    setScenario(s); setVersion(v); setRunning(true); setText(''); setSteps([]); setUsage(null); setElapsed(null)
    setTraceId(null); setTrace(null); setError(null); setTraceError(null)
    try {
      const resp = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scenario: s.id, version: v }) })
      await readSSE(resp, ev => {
        const type = ev.type as string
        if (type === 'delta') setText(t => t + (ev.text as string))
        else if (type === 'agent' || type === 'tool_call' || type === 'tool_response') setSteps(st => [...st, { ...(ev as object), kind: type } as LiveStep])
        else if (type === 'usage') setUsage(ev as unknown as Usage)
        else if (type === 'done') { setElapsed(ev.t as number); setTraceId((ev.trace_id as string) ?? null); setText(t => t || ((ev.text as string) ?? '')) }
        else if (type === 'error') setError(ev.message as string)
      })
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'The run could not be started.')
    } finally { setRunning(false) }
  }

  const loadTrace = async () => {
    if (!traceId) return
    setTraceError(null)
    try { setTrace(await getJSON<Trace>(`/api/trace/${traceId}`)) }
    catch (e) { setTraceError(e instanceof ApiError ? e.message : 'Trace not available.') }
  }
  const letter = useMemo(() => {
    const r = steps.find(s => s.kind === 'tool_response' && s.name?.endsWith('generate_decision_letter'))
    return typeof r?.content === 'string' ? r.content : null
  }, [steps])

  const toolCalls = useMemo(() => steps.filter(s => s.kind === 'tool_call'), [steps])
  const amlCalled = toolCalls.some(s => s.name?.endsWith('aml_screening'))
  const decision = useMemo(() => {
    const letter = toolCalls.find(s => s.name?.endsWith('generate_decision_letter'))
    return (letter?.args as { decision?: string } | undefined)?.decision ?? null
  }, [toolCalls])

  if (!catalog) return <p className="text-sm text-ink-muted">Loading…</p>

  return (
    <div className="grid lg:grid-cols-[320px_1fr] gap-6">
      <aside className="space-y-4">
        <div className="card p-4">
          <div className="eyebrow mb-1">Step 1</div><h2 className="font-semibold mb-1 !text-coral">Pick the agentic system version</h2>
          <p className="text-xs text-ink-muted mb-3">Same tools and orchestrator; only the compliance agent differs.</p>
          <div className="space-y-2">
            {(Object.keys(catalog.versions) as Version[]).map(v => (
              <label key={v} className={`flex gap-2 items-start p-2 rounded border cursor-pointer ${version === v ? 'border-accent bg-accent-soft' : 'border-ink-line'}`}>
                <input type="radio" className="mt-1" checked={version === v} onChange={() => setVersion(v)} disabled={running} />
                <span><span className="text-sm font-medium"><span className={`dot ${v === 'v1' ? 'bg-warn' : 'bg-ok'}`} />{catalog.versions[v].label}</span><br /><span className="text-xs text-ink-muted">{catalog.versions[v].note}</span></span>
              </label>
            ))}
          </div>
        </div>
        <div className="card p-4">
          <div className="eyebrow mb-1">Step 2</div><h2 className="font-semibold mb-1 !text-coral">Submit an application</h2>
          <p className="text-xs text-ink-muted mb-3">Five fixed applicants, also the evaluation test cases.</p>
          <div className="space-y-2">
            {catalog.scenarios.map(s => (
              <button key={s.id} disabled={running} onClick={() => run(s, version)}
                className={`w-full text-left p-2.5 rounded border transition-colors ${scenario?.id === s.id ? 'border-accent bg-accent-soft' : 'border-ink-line hover:bg-ink-raised'} disabled:opacity-60`}>
                <div className="flex items-center justify-between"><span className="text-sm font-medium">{s.applicant}</span><Play size={13} className="text-accent" /></div>
                <div className="text-xs text-ink-muted">{s.title} · expected <span className="font-mono text-ink-text">{s.expected_decision}</span></div>
              </button>
            ))}
          </div>
        </div>
      </aside>

      <section className="space-y-4 min-w-0">
        {!scenario && (
          <div className="card p-6 text-sm text-ink-muted space-y-2">
            <p className="text-sm font-semibold text-apricot">Why it matters: an agent that is wrong does not look wrong. It answers politely, with a reference number.</p>
            <p>Pick a version and an applicant to watch every handoff, tool call and token, then compare v1 and v2 on the same applicant.</p>
          </div>
        )}
        {scenario && (
          <>
            <div className="card p-4">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-semibold">{scenario.applicant}</span>
                <span className="pill-gray font-mono">{short(catalog.versions[version].agent)}</span>
                {running && <span className="flex items-center gap-1 h-4 ml-1"><span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" /></span>}
                {elapsed !== null && <span className="pill-blue"><Clock size={11} />{(elapsed / 1000).toFixed(1)} s</span>}
                {usage?.total && <span className="pill-blue"><Coins size={11} />{usage.total.toLocaleString()} tokens</span>}
                {decision && <span className={decision === scenario.expected_decision ? 'pill-green' : 'pill-red'}>decision {decision}{decision !== scenario.expected_decision ? ` (expected ${scenario.expected_decision})` : ''}</span>}
                {!running && elapsed !== null && <span className={amlCalled ? 'pill-green' : 'pill-red'}>{amlCalled ? 'AML screening ran' : 'AML screening skipped'}</span>}
              </div>
              <div className="mt-3 bg-accent-strong text-white rounded-2xl rounded-br-sm px-3 py-2 text-sm max-w-prose ml-auto">{scenario.message}</div>
              <div className="mt-3 text-sm prose-chat min-h-[2rem]">
                {error ? <p className="text-bad">{error}</p> : <ReactMarkdown>{text}</ReactMarkdown>}
              </div>
              {letter && (
                <details className="mt-3 text-xs">
                  <summary className="cursor-pointer text-accent">Decision letter as returned by the generate_decision_letter tool</summary>
                  <pre className="mt-2 whitespace-pre-wrap font-sans bg-ink-raised rounded p-3">{letter}</pre>
                </details>
              )}
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="card p-4">
                <h3 className="font-semibold text-sm mb-2 flex items-center gap-2"><ArrowRightLeft size={14} />Live run: agents and tool calls</h3>
                <p className="text-xs text-ink-muted mb-2">Built from the run's event stream as it happens.</p>
                <ol className="space-y-1 text-xs">
                  {steps.map((s, i) => {
                    if (s.kind === 'agent') return <li key={i} className="mt-2 font-semibold text-violet flex items-center gap-1"><Cpu size={12} />{short(s.agent ?? '')}<span className="text-ink-muted font-normal ml-auto">{(s.t / 1000).toFixed(1)} s</span></li>
                    if (s.kind === 'tool_call') return <li key={i} className="ml-4 flex items-center gap-1 font-mono">{s.handoff ? <ArrowRightLeft size={11} className="text-violet" /> : <Wrench size={11} />}{short(s.name ?? '')}</li>
                    if (typeof s.content === 'string' && s.content.startsWith('Transferring to')) return null
                    return <li key={i} className="ml-8 text-ink-muted font-mono truncate" title={typeof s.content === 'string' ? s.content : JSON.stringify(s.content)}>↳ {typeof s.content === 'string' ? s.content : JSON.stringify(s.content)}</li>
                  })}
                </ol>
                {usage && usage.models.length > 0 && (
                  <table className="mt-3 w-full text-xs">
                    <thead><tr className="text-left text-ink-muted"><th>model</th><th className="text-right">prompt</th><th className="text-right">completion</th></tr></thead>
                    <tbody>{usage.models.map((m, i) => <tr key={i}><td className="font-mono">{m.model}</td><td className="text-right">{m.prompt_tokens?.toLocaleString()}</td><td className="text-right">{m.completion_tokens?.toLocaleString()}</td></tr>)}</tbody>
                  </table>
                )}
              </div>
              <div className="card p-4">
                <h3 className="font-semibold text-sm mb-2">Platform trace (Agent Analytics)</h3>
                <p className="text-xs text-ink-muted mb-2">The same run as recorded by watsonx Orchestrate observability: tokens and latency per model call and tool.</p>
                {!trace && (
                  <button className="btn-secondary" onClick={loadTrace} disabled={!traceId || running || traceReadyIn > 0}>
                    {traceId && traceReadyIn > 0 ? `Platform is indexing the run… ${traceReadyIn}s` : 'Load platform trace'}
                  </button>
                )}
                {trace && <button className="text-xs text-accent mb-2" onClick={loadTrace}>Refresh</button>}
                {traceError && <p className="text-xs text-bad mt-2">{traceError}</p>}
                {trace && (
                  <>
                    <div className="flex flex-wrap gap-2 mb-2">
                      <span className="pill-blue"><Clock size={11} />{(trace.latency_ms / 1000).toFixed(1)} s end to end</span>
                      {Object.entries(trace.tokens_by_model).map(([m, t]) => <span key={m} className="pill-gray">{m}: {t.calls} calls, {t.input.toLocaleString()} in / {t.output.toLocaleString()} out</span>)}
                    </div>
                    <ol className="text-xs font-mono space-y-0.5 max-h-80 overflow-auto">
                      {trace.spans.filter(s => s.kind !== 'root').map((s, i) => (
                        <li key={i} className={`flex gap-2 ${s.kind === 'handoff' ? 'text-violet' : s.kind === 'generation' ? 'text-ink-muted ml-4' : 'ml-4'}`}>
                          <span className="truncate">{s.kind === 'generation' ? `llm ${s.name}` : short(s.name)}</span>
                          <span className="ml-auto shrink-0">{s.kind === 'generation' ? `${s.input_tokens}+${s.output_tokens} tok · ` : ''}{s.latency_ms ?? 0} ms</span>
                        </li>
                      ))}
                    </ol>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
