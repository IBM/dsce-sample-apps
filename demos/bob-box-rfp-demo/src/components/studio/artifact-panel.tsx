'use client'

import { Check, FileText, FolderSearch, Loader2, Mail, Presentation, Upload } from 'lucide-react'
import { BoxMark } from '@/components/studio/brand'
import { ContextBrief } from '@/components/studio/context-brief'
import { EmailDraft } from '@/components/studio/email-draft'
import { GeneratingSkeleton } from '@/components/studio/generating-skeleton'
import { ResponseDocument } from '@/components/response-document'
import { SlideDeck } from '@/components/slide-deck'
import { Button } from '@/components/ui/button'
import { VENDOR_NAME, type BoxFile } from '@/lib/mock-data'
import type { Artifact, ArtifactType } from '@/lib/studio-types'
import { cn } from '@/lib/utils'

const icons: Record<ArtifactType, typeof FileText> = {
  brief: FolderSearch,
  response: FileText,
  deck: Presentation,
  email: Mail,
}

export type SaveState = 'idle' | 'saving' | 'saved'

export function ArtifactPanel({
  artifacts,
  activeId,
  onSelect,
  generatingId,
  unseen,
  saveState,
  onSave,
  onOpenSource,
  boxFileIds = {},
  boxDocContents = {},
}: {
  artifacts: Artifact[]
  activeId: string | null
  onSelect: (id: string) => void
  generatingId: string | null
  unseen: string[]
  saveState: SaveState
  onSave: () => void
  onOpenSource: (file: BoxFile) => void
  boxFileIds?: Record<string, string>
  boxDocContents?: Record<string, string>
}) {
  const active = artifacts.find((a) => a.id === activeId)
  const isGenerating = !!active && active.id === generatingId
  const canSave = !!active && !isGenerating && active.type !== 'brief'

  return (
    <section aria-label="Generated assets" className="flex h-full min-h-0 flex-col bg-secondary/60">
      <div className="flex h-12 shrink-0 items-end justify-between gap-2 border-b border-border px-2">
        <div role="tablist" aria-label="Assets" className="flex min-w-0 items-end gap-1 overflow-x-auto overflow-y-hidden no-scrollbar">
          {artifacts.map((a) => {
            const Icon = icons[a.type] ?? FileText
            const selected = a.id === activeId
            const generating = a.id === generatingId
            const hasUpdate = unseen.includes(a.id)
            return (
              <button
                key={a.id}
                role="tab"
                type="button"
                aria-selected={selected}
                onClick={() => onSelect(a.id)}
                className={cn(
                  '-mb-px flex shrink-0 items-center gap-2 rounded-t-md border border-b-0 px-3 py-2 text-sm transition-colors animate-in fade-in slide-in-from-bottom-1 duration-300',
                  selected
                    ? 'border-border bg-background text-foreground shadow-xs font-medium'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                {generating ? (
                  <Loader2 className="size-4 animate-spin text-box" aria-hidden="true" />
                ) : (
                  <Icon className="size-4" aria-hidden="true" />
                )}
                {a.title}
                {a.version > 0 && <span className="font-mono text-xs text-muted-foreground">v{a.version}</span>}
                {hasUpdate && (
                  <span className="relative flex size-2" aria-label="Updated">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-box opacity-60" />
                    <span className="relative inline-flex size-2 rounded-full bg-box" />
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {canSave && (
          <div className="mb-2 shrink-0">
            {saveState === 'saved' ? (
              <span className="flex h-8 items-center gap-1.5 rounded-md px-2 text-xs text-success animate-in fade-in zoom-in-95">
                <Check className="size-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">Saved to</span>
                <span className="font-mono">/IBM Bob - Acme Bank RFP/Generated RFP Responses</span>
              </span>
            ) : (
              <Button size="sm" variant="outline" onClick={onSave} disabled={saveState === 'saving'} className="h-8 gap-1.5">
                {saveState === 'saving' ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Upload className="size-3.5" aria-hidden="true" />
                )}
                Save to <BoxMark className="text-xs" />
              </Button>
            )}
          </div>
        )}
      </div>

      <div role="tabpanel" className="min-h-0 flex-1 overflow-y-auto bg-background p-4 md:p-8">
        {!active && (
          <div className="flex h-full items-center justify-center">
            <p className="max-w-xs text-center text-sm leading-relaxed text-muted-foreground">
              Generated documents and presentations will open here as tabs.
            </p>
          </div>
        )}
        {active && isGenerating && <GeneratingSkeleton type={active.type} />}
        {active && !isGenerating && (
          <div key={active.id} className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            {active.type === 'brief' && <ContextBrief onOpenSource={onOpenSource} boxFileIds={boxFileIds} boxDocContents={boxDocContents} />}
            {active.type === 'response' && active.doc && <ResponseDocument doc={active.doc} companyName={VENDOR_NAME} />}
            {active.type === 'deck' && (
              <SlideDeck
                slides={active.doc?.slides}
                title={active.doc?.title ?? 'Acme Bank - AI-Powered Document Intelligence Presentation'}
                companyName={VENDOR_NAME}
              />
            )}
            {active.type === 'email' && active.email && <EmailDraft text={active.email} />}
          </div>
        )}
      </div>
    </section>
  )
}
