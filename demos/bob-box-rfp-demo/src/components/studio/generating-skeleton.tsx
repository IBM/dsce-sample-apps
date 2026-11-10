import { BobMark } from '@/components/studio/brand'
import type { ArtifactType } from '@/lib/studio-types'

const LABELS: Record<ArtifactType, string> = {
  brief: 'Organizing research',
  response: 'Writing response',
  deck: 'Designing slides',
  email: 'Drafting email',
}

function Bar({ className }: { className: string }) {
  return <div className={`h-3 rounded bg-secondary ${className}`} />
}

export function GeneratingSkeleton({ type }: { type: ArtifactType }) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6" aria-busy="true" aria-live="polite">
      <p className="flex items-center gap-2 text-sm">
        <BobMark className="text-xs" />
        <span className="shimmer-text animate-shimmer font-medium">{LABELS[type]}…</span>
      </p>

      {type === 'deck' ? (
        <div className="flex flex-col gap-3">
          <div className="flex aspect-video flex-col justify-end gap-3 rounded-lg border border-border bg-card p-8 animate-pulse">
            <Bar className="w-1/3" />
            <div className="h-6 w-2/3 rounded bg-secondary" />
            <Bar className="w-1/2" />
          </div>
          <div className="flex gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="aspect-video flex-1 rounded-md border border-border bg-card animate-pulse"
                style={{ animationDelay: `${i * 120}ms` }}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="h-7 w-3/5 rounded bg-secondary animate-pulse" />
          {[0, 1, 2].map((block) => (
            <div key={block} className="flex flex-col gap-2 animate-pulse" style={{ animationDelay: `${block * 150}ms` }}>
              <div className="h-4 w-1/4 rounded bg-secondary" />
              <Bar className="w-full" />
              <Bar className="w-11/12" />
              <Bar className="w-4/5" />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
