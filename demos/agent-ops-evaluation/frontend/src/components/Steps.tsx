import { useState } from 'react'
import { ArrowRightLeft, Wrench, MessageSquare, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { short, type Step } from '../api'

const pretty = (v: unknown) => (typeof v === 'string' ? v : JSON.stringify(v, null, 2))

/** One tool call / handoff / response / message as a compact, expandable row. */
export function StepRow({ step, expected }: { step: Step; expected?: Set<string> }) {
  const [open, setOpen] = useState(false)
  if (step.kind === 'message') {
    if (!step.text) return null
    const isUser = step.role === 'user'
    return (
      <div className={`flex gap-2 my-2 ${isUser ? 'justify-end' : ''}`}>
        <div className={`${isUser ? 'bg-accent-strong text-white rounded-2xl rounded-br-sm' : 'bg-ink-raised rounded-2xl rounded-bl-sm'} px-3 py-2 max-w-[90%] text-sm`}>
          <div className="flex items-center gap-1 text-[11px] opacity-70 mb-0.5"><MessageSquare size={11} />{isUser ? 'simulated user' : 'agent'}</div>
          <div className="prose-chat"><ReactMarkdown>{step.text}</ReactMarkdown></div>
        </div>
      </div>
    )
  }
  const flagged = !!step.reason
  const isHandoff = step.kind === 'handoff'
  const isResponse = step.kind === 'tool_response'
  const label = short(step.name ?? '')
  const toneClass = flagged ? 'border-bad bg-bad-soft' : isHandoff ? 'border-violet bg-violet-soft' : 'border-ink-line bg-ink-surface'
  return (
    <div className={`border-l-2 ${toneClass} rounded-r px-2 py-1 my-1 text-xs`}>
      <button className="flex items-center gap-2 w-full text-left" onClick={() => setOpen(o => !o)}>
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {isHandoff ? <ArrowRightLeft size={12} className="text-violet" /> : <Wrench size={12} className="text-ink-muted" />}
        <span className="font-mono">{isResponse ? `${label} ⇢ response` : label}</span>
        {expected && !isResponse && expected.has(step.name ?? '') && !flagged && <span className="pill-green">expected</span>}
        {flagged && <span className="pill-red"><AlertTriangle size={10} />{step.reason}</span>}
      </button>
      {open && (
        <pre className="mt-1 whitespace-pre-wrap break-words font-mono text-[11px] text-ink-muted max-h-56 overflow-auto">
          {isResponse ? pretty(step.content) : pretty(step.args)}
          {flagged && step.expected ? `\n\nexpected: ${pretty(step.expected)}` : ''}
        </pre>
      )}
    </div>
  )
}

export function StepList({ steps, expected }: { steps: Step[]; expected?: Set<string> }) {
  return <div>{steps.map((s, i) => <StepRow key={i} step={s} expected={expected} />)}</div>
}
