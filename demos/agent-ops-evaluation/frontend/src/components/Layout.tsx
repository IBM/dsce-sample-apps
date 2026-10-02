import { NavLink, Outlet } from 'react-router-dom'
import { Activity, FlaskConical, ListChecks, ShieldAlert, BookOpen, Bot, CircleCheck } from 'lucide-react'

const tabs = [
  { to: '/overview', label: 'Overview', icon: BookOpen },
  { to: '/run', label: 'Run a scenario', icon: Activity },
  { to: '/evaluate', label: 'Evaluate', icon: FlaskConical },
  { to: '/rubric', label: 'Rubric', icon: ListChecks },
  { to: '/red-team', label: 'Red team', icon: ShieldAlert },
]

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-ink-bg border-b border-ink-line">
        <div className="w-[90%] max-w-[1600px] mx-auto px-4 sm:px-6 pt-4 pb-3 flex items-center gap-4">
          <div className="relative w-10 h-10 rounded-lg bg-accent-soft border border-accent/30 flex items-center justify-center shrink-0" aria-hidden="true">
            <Bot size={22} className="text-accent" />
            <span className="absolute -right-1 -bottom-1 rounded-full bg-ink-bg p-[1px]"><CircleCheck size={13} className="text-teal" /></span>
          </div>
          <div>
            <div className="text-2xl font-semibold tracking-tight text-ink-text leading-tight">Agent Ops</div>
            <div className="text-sm text-ink-muted">Build-time agent evaluation powered by <span className="text-accent">watsonx Orchestrate</span></div>
          </div>
        </div>
        <nav className="w-[90%] max-w-[1600px] mx-auto px-4 sm:px-6 flex gap-1 overflow-x-auto">
          {tabs.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to}
              className={({ isActive }) => `flex items-center gap-2 px-3 py-2.5 text-base border-b-2 whitespace-nowrap ${isActive ? 'border-accent text-ink-text' : 'border-transparent text-ink-muted hover:text-ink-text'}`}>
              <Icon size={17} />{label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="flex-1 w-[90%] max-w-[1600px] w-full mx-auto px-4 sm:px-6 py-6">
        <Outlet />
      </main>
      <footer className="text-xs text-ink-muted w-[90%] max-w-[1600px] mx-auto px-4 sm:px-6 py-4 border-t border-ink-line w-full flex flex-wrap gap-x-6 gap-y-1 items-center">
        <span>All applicants, credit data and sanctions results are fictitious. Everything shown runs live against watsonx Orchestrate.</span>
        <span className="flex gap-4 ml-auto">
          <a className="hover:text-accent" href="https://www.ibm.com/products/watsonx-orchestrate" target="_blank" rel="noreferrer">watsonx Orchestrate</a>
          <a className="hover:text-accent" href="https://developer.watson-orchestrate.ibm.com/evaluate/overview" target="_blank" rel="noreferrer">Evaluation framework docs</a>
          <a className="hover:text-accent" href="https://github.com/IBM/dsce-sample-apps/tree/main/demos/agent-ops-evaluation" target="_blank" rel="noreferrer">Source</a>
        </span>
      </footer>
    </div>
  )
}
