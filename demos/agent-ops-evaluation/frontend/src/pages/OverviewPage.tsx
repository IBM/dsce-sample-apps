import { Link } from 'react-router-dom'
import { Activity, FlaskConical, ListChecks, ShieldAlert, FileCheck2, RefreshCw, Scale } from 'lucide-react'
import { short } from '../api'
import { useStore } from '../store'

function Box({ title, sub, note, tone = 'gray' }: { title: string; sub: string; note?: string; tone?: 'blue' | 'gray' }) {
  const cls = tone === 'blue' ? 'border-accent bg-accent-soft' : 'border-ink-line bg-ink-raised/60'
  return (
    <div className={`rounded border ${cls} px-2.5 py-1.5`}>
      <div className="text-xs font-medium font-mono leading-tight">{title}{note && <span className="font-sans font-medium text-apricot"> · {note}</span>}</div>
      <div className="text-[11px] text-ink-muted">{sub}</div>
    </div>
  )
}

const VALUE = [
  { icon: FileCheck2, title: 'Confidence for release decisions', text: 'Journey success, routing and tool-call accuracy per test case, with the full transcript behind every number.' },
  { icon: RefreshCw, title: 'A regression suite for agents', text: 'Test cases are files. Rerun them after every prompt, tool or model change, in about a minute.' },
  { icon: Scale, title: 'Policy and resilience, tested', text: 'Plain-language compliance rules become pass/fail checks; a red team shows how the agent holds up under pressure.' },
]

export default function OverviewPage() {
  const { catalog } = useStore()
  return (
    <div className="space-y-6">
      <section>
        <h2 className="section-title">Why Agent Ops</h2>
        <div className="card p-6">
          <h1 className="text-xl font-semibold mb-2 tracking-tight text-ink-text">Is the agent doing the right thing? Prove it before release.</h1>
          <p className="text-sm text-ink-muted">
            Building an agent is easy. Proving that it routes correctly, calls the right tools and reaches the right decision, before release and after every change, is not. This demo runs the watsonx Orchestrate evaluation framework live against a loan-underwriting assistant in two versions: v1, whose compliance agent skipped anti-money-laundering (AML) screening for self-employed applicants, and v2, after evaluating and optimizing.
          </p>
          <h3 className="text-sm font-semibold !text-ink-text mt-5 mb-2">What Agent Ops gives your team</h3>
          <div className="grid md:grid-cols-3 gap-5">
            {VALUE.map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-lg border border-ink-line bg-ink-raised/60 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-teal"><Icon size={14} className="text-teal" />{title}</div>
                <p className="text-xs text-ink-muted mt-1.5">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <h2 className="section-title">Agents in this demo</h2>
        <div className="card p-5">
        <p className="text-sm text-ink-muted mb-3">The orchestrator asks three specialist agents in turn, then produces the decision letter. Two versions: <span className="text-ink-text">v1</span> as first shipped, <span className="text-ink-text">v2</span> after evaluating and optimizing.</p>
        <div className="grid lg:grid-cols-[3fr_1px_2fr] gap-6 items-center">
          <div>
            <div className="flex justify-center"><Box title="loan_orchestrator" sub="plans the journey · writes the letter" tone="blue" /></div>
            <svg viewBox="0 0 100 12" preserveAspectRatio="none" className="w-full h-5 text-ink-faint" aria-hidden="true">
              <path d="M50 0 V6 M16.7 6 H83.3 M16.7 6 V12 M50 6 V12 M83.3 6 V12" fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
            </svg>
            <div className="grid grid-cols-3 gap-4">
              <Box title="intake_agent" sub="validates the application" />
              <Box title="credit_risk_agent" sub="credit bureau · PASS / REFER / FAIL" />
              <Box title="compliance_agent" note="v1 has the issue, v2 is the fix" sub="sanctions + AML · CLEAR / CAUTION / BLOCKED" />
            </div>
          </div>
          <div className="hidden lg:block w-px self-stretch bg-ink-line" />
          {catalog && (
            <div className="space-y-3 text-sm">
              {(['v1', 'v2'] as const).map(v => (
                <div key={v} className="rounded border border-ink-line px-3 py-2">
                  <div className="font-medium"><span className={`dot ${v === 'v1' ? 'bg-warn' : 'bg-ok'}`} />{catalog.versions[v].label}</div>
                  <div className="text-xs text-ink-muted">{catalog.versions[v].note}</div>
                  <div className="text-xs font-mono mt-1 text-ink-muted">{short(catalog.versions[v].agent)} · {short(catalog.versions[v].compliance_agent)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        </div>
      </section>

      <section>
        <h2 className="section-title">What you can do in this demo</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            { to: '/run', icon: Activity, title: 'Run a scenario', text: 'Submit one of five fixed applications and watch every handoff and tool call.' },
            { to: '/evaluate', icon: FlaskConical, title: 'Evaluate', text: 'Replay the five test cases; score journey success, routing and tool calls.' },
            { to: '/rubric', icon: ListChecks, title: 'Rubric', text: 'A judge model checks each conversation against four compliance rules.' },
            { to: '/red-team', icon: ShieldAlert, title: 'Red team', text: 'An attacker model tries three ways to skip the AML check.' },
          ].map(({ to, icon: Icon, title, text }) => (
            <Link key={to} to={to} className="card p-4 hover:border-accent transition-colors">
              <div className="flex items-center gap-2 font-semibold"><Icon size={16} className="text-accent" />{title}</div>
              <p className="text-xs text-ink-muted mt-1.5">{text}</p>
            </Link>
          ))}
        </div>
      </section>

    </div>
  )
}
