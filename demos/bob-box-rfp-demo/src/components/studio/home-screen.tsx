import { FileText, Presentation, Search, Mail } from 'lucide-react'
import { BobMark, BoxMark, BrandLockup } from '@/components/studio/brand'
import { PromptInput } from '@/components/studio/prompt-input'

const SUGGESTIONS = [
  { icon: FileText, text: 'Help me write an RFP response for Acme Bank' },
  { icon: Search, text: 'What do we know about Acme Bank in Box?' },
  { icon: Presentation, text: 'Build a pitch deck for Acme Bank from our product docs' },
  { icon: Mail, text: 'Draft a follow-up email to the Acme Bank buying team' },
]

export function HomeScreen({ onSubmit }: { onSubmit: (text: string) => void }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-14 items-center px-6">
        <BrandLockup className="text-sm" />
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-4 pb-24 pt-8">
        <div className="flex w-full max-w-2xl flex-col gap-8">
          <div className="flex flex-col items-center gap-4 text-center">
            <h1 className="text-balance text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
              What should we build from your Box today?
            </h1>
            <p className="max-w-xl text-pretty leading-relaxed text-muted-foreground">
              Ask anything. Bob searches your Box content, such as contracts, product docs, past proposals, and customer files. It then turns what it finds into documents, decks, and emails you can refine.
            </p>
          </div>

          <PromptInput size="large" onSubmit={onSubmit} placeholder="Ask Bob about anything in your Box…" />

          <ul className="grid gap-2 sm:grid-cols-2" aria-label="Suggested prompts">
            {SUGGESTIONS.map(({ icon: Icon, text }) => (
              <li key={text}>
                <button
                  type="button"
                  onClick={() => onSubmit(text)}
                  className="flex h-full w-full items-start gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-left text-sm leading-relaxed text-foreground/80 transition-colors hover:border-primary/40 hover:text-foreground"
                >
                  <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  {text}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </main>

      <footer className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 pb-6 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          Reasoning by <BobMark className="text-xs" />
        </span>
        <span aria-hidden="true">{'·'}</span>
        <span className="flex items-center gap-1.5">
          Content from <BoxMark className="text-xs" />
        </span>
      </footer>
    </div>
  )
}
