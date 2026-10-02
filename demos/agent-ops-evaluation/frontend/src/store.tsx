/** App-wide state: the catalog, the latest result per job kind, and job runs with streamed logs. */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { ApiError, getJSON, postJSON, readSSE, type AnyResult, type Catalog, type JobKind } from './api'

interface JobState { running: boolean; lines: string[]; error: string | null }

interface Store {
  catalog: Catalog | null
  results: Partial<Record<JobKind, AnyResult>>
  jobs: Partial<Record<JobKind, JobState>>
  loadResult: (kind: JobKind) => Promise<void>
  runJob: (kind: JobKind, force?: boolean) => Promise<void>
  busyKind: JobKind | null
}

const Ctx = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [results, setResults] = useState<Partial<Record<JobKind, AnyResult>>>({})
  const [jobs, setJobs] = useState<Partial<Record<JobKind, JobState>>>({})
  const [busyKind, setBusyKind] = useState<JobKind | null>(null)
  const loaded = useRef(new Set<JobKind>())

  useEffect(() => { getJSON<Catalog>('/api/catalog').then(setCatalog).catch(() => setCatalog(null)) }, [])

  const setJob = (kind: JobKind, patch: Partial<JobState>) =>
    setJobs(j => ({ ...j, [kind]: { running: false, lines: [], error: null, ...j[kind], ...patch } }))

  const loadResult = useCallback(async (kind: JobKind) => {
    if (loaded.current.has(kind)) return
    loaded.current.add(kind)
    try {
      const r = await getJSON<AnyResult>(`/api/results/${kind}`)
      setResults(x => ({ ...x, [kind]: r }))
    } catch { /* no result yet */ }
  }, [])

  const attach = useCallback(async (kind: JobKind, jobId: string) => {
    const resp = await fetch(`/api/jobs/${jobId}/stream`)
    const lines: string[] = []
    await readSSE(resp, ev => {
      if (typeof ev.line === 'string') {
        lines.push(ev.line)
        if (lines.length % 3 === 0) setJob(kind, { lines: [...lines] })
      }
      if (ev.done) {
        setJob(kind, { lines: [...lines], running: false, error: (ev.error as string) ?? null })
        if (ev.result) setResults(x => ({ ...x, [kind]: ev.result as AnyResult }))
      }
    })
    setJob(kind, { lines: [...lines], running: false })
  }, [])

  const runJob = useCallback(async (kind: JobKind, force = false) => {
    setJob(kind, { running: true, lines: [], error: null })
    setBusyKind(kind)
    try {
      const r = await postJSON<{ cached: boolean; result?: AnyResult; job?: { job_id: string } }>(`/api/jobs/${kind}`, { force })
      if (r.cached && r.result) {
        setResults(x => ({ ...x, [kind]: r.result! }))
        setJob(kind, { running: false, lines: ['Showing the result from a few minutes ago. Use "Run again" to start a fresh run.'] })
      } else if (r.job) {
        await attach(kind, r.job.job_id)
      }
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'The run could not be started.'
      setJob(kind, { running: false, error: msg })
    } finally {
      setBusyKind(null)
    }
  }, [attach])

  return <Ctx.Provider value={{ catalog, results, jobs, loadResult, runJob, busyKind }}>{children}</Ctx.Provider>
}

export function useStore(): Store {
  const s = useContext(Ctx)
  if (!s) throw new Error('StoreProvider missing')
  return s
}
