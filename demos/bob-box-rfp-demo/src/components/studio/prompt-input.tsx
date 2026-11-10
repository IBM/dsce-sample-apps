'use client'

import { useState } from 'react'
import { ArrowUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function PromptInput({
  onSubmit,
  disabled,
  placeholder,
  size = 'default',
}: {
  onSubmit: (text: string) => void
  disabled?: boolean
  placeholder: string
  size?: 'default' | 'large'
}) {
  const [value, setValue] = useState('')

  function submit() {
    const text = value.trim()
    if (!text || disabled) return
    onSubmit(text)
    setValue('')
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
      className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3 shadow-sm transition-colors focus-within:border-primary/40"
    >
      <label htmlFor={`prompt-${size}`} className="sr-only">
        Prompt
      </label>
      <textarea
        id={`prompt-${size}`}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== 'Enter' || e.shiftKey) return
          if (e.nativeEvent.isComposing || e.keyCode === 229) return
          e.preventDefault()
          submit()
        }}
        placeholder={placeholder}
        rows={size === 'large' ? 3 : 2}
        className={cn(
          'w-full resize-none bg-transparent leading-relaxed text-foreground outline-none placeholder:text-muted-foreground',
          size === 'large' ? 'text-base' : 'text-sm',
        )}
      />
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
          Box connected (demo)
        </span>
        <Button type="submit" size="icon" className="size-8 rounded-lg" disabled={disabled || !value.trim()}>
          <ArrowUp aria-hidden="true" />
          <span className="sr-only">Send</span>
        </Button>
      </div>
    </form>
  )
}
