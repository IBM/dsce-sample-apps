import { FileText } from 'lucide-react'
import { CONTEXT_GROUPS, OPEN_QUESTIONS, type BoxFile } from '@/lib/mock-data'

export function ContextBrief({
  onOpenSource,
  boxFileIds = {},
  boxDocContents = {},
}: {
  onOpenSource: (file: BoxFile) => void
  boxFileIds?: Record<string, string>
  boxDocContents?: Record<string, string>
}) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-balance text-2xl font-semibold tracking-tight text-foreground">Research brief</h2>
        <p className="leading-relaxed text-muted-foreground">
          Pulled from files across Box (<span className="font-mono text-xs">IBM Bob - Acme Bank RFP</span>). Click any file to see the passage Bob used.
        </p>
      </div>

      {CONTEXT_GROUPS.map((g) => (
        <section key={g.id} className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground">{g.title}</h3>
          <p className="text-pretty leading-relaxed text-foreground/85">{g.summary}</p>
          <ul className="flex flex-col gap-1.5 pl-4">
            {g.items.map((item) => (
              <li key={item} className="list-disc text-sm leading-relaxed text-foreground/85">
                {item}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2 border-t border-border pt-3">
            {g.sources.map((s) => {
              const fileId = boxFileIds[s.name]
              const liveContent = boxDocContents[s.name]
              return (
              <button
                type="button"
                key={s.name}
                title={`Preview ${s.folder}/${s.name}`}
                onClick={() => onOpenSource({ ...s, boxFileId: fileId, liveContent })}
                className="flex items-center gap-1.5 rounded-md bg-secondary px-2 py-1 text-xs text-secondary-foreground transition-colors hover:bg-box/10 hover:text-box"
              >
                <FileText className="size-3.5" aria-hidden="true" />
                {s.name}
                <span className="text-muted-foreground">{s.modified}</span>
              </button>
              )
            })}
          </div>
        </section>
      ))}

      <section className="flex flex-col gap-2 rounded-lg border border-accent bg-accent/20 p-5">
        <h3 className="text-lg font-semibold text-foreground">Open questions</h3>
        <ul className="flex flex-col gap-1.5 pl-4">
          {OPEN_QUESTIONS.map((q) => (
            <li key={q} className="list-disc text-sm leading-relaxed text-foreground">
              {q}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
