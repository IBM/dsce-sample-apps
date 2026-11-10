'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function EmailDraft({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div className="flex justify-end">
        <Button
          size="sm"
          variant="outline"
          onClick={async () => {
            await navigator.clipboard.writeText(text)
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          }}
        >
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      <article className="whitespace-pre-wrap rounded-lg border border-border bg-card p-6 leading-relaxed text-foreground">
        {text}
      </article>
    </div>
  )
}
