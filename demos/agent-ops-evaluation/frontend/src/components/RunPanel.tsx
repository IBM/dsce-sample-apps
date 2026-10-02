import { useEffect, useState } from 'react'
import { Play, RotateCw, TerminalSquare } from 'lucide-react'
import Terminal from './Terminal'
import { fmtWhen, type JobKind } from '../api'
import { useStore } from '../store'

/** Run button + live log for one job kind; children render the result. */
export default function RunPanel({ kind, title, subtitle, estimate, children }: {
  kind: JobKind; title: string; subtitle: string; estimate: string; children: React.ReactNode
}) {
  const { results, jobs, runJob, loadResult, busyKind } = useStore()
  const [showLog, setShowLog] = useState(false)
  const result = results[kind]
  const job = jobs[kind]
  useEffect(() => { loadResult(kind) }, [kind, loadResult])
  useEffect(() => { if (job?.running) setShowLog(true) }, [job?.running])
  const otherBusy = busyKind !== null && busyKind !== kind

  return (
    <div className="card p-4 space-y-3">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1 min-w-[200px]">
          <h3 className="font-semibold"><span className={`dot ${kind.endsWith('v1') ? 'bg-warn' : 'bg-ok'}`} />{title}</h3>
          <p className="text-xs text-ink-muted">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          {result && !job?.running && <span className="text-xs text-ink-muted">last run {fmtWhen(result.completed_at)} · {result.duration_s}s</span>}
          <button className="btn-primary" disabled={!!job?.running || otherBusy} onClick={() => runJob(kind, !!result)} title={otherBusy ? 'Another run is in progress' : estimate}>
            {job?.running ? <RotateCw size={14} className="animate-spin" /> : <Play size={14} />}
            {job?.running ? 'Running…' : result ? 'Run again' : 'Run now'}
          </button>
        </div>
      </div>
      {job?.error && <p className="text-sm text-bad">{job.error}</p>}
      {(job?.lines?.length ?? 0) > 0 && (
        <div>
          <button className="text-xs text-accent flex items-center gap-1" onClick={() => setShowLog(s => !s)}><TerminalSquare size={12} />{showLog ? 'Hide' : 'Show'} framework output ({job!.lines.length} lines)</button>
          {showLog && <div className="mt-2"><Terminal lines={job!.lines} /></div>}
        </div>
      )}
      {job?.running && !result && <p className="text-xs text-ink-muted">{estimate}</p>}
      {result && <div className={job?.running ? 'opacity-50' : ''}>{children}</div>}
      {!result && !job?.running && <p className="text-sm text-ink-muted">No result yet. {estimate}</p>}
    </div>
  )
}
