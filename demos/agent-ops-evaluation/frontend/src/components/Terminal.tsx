import { useEffect, useRef } from 'react'

/** Monospace log pane that follows the output. */
export default function Terminal({ lines, placeholder = 'Waiting for output…', maxHeight = 'max-h-80' }: { lines: string[]; placeholder?: string; maxHeight?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight }, [lines])
  const tone = (l: string) => {
    const s = l.toLowerCase()
    if (s.includes('[error]') || s.includes('failed')) return 'text-red-300'
    if (s.includes('warning')) return 'text-yellow-200'
    if (s.includes('succe') || s.includes('✔') || s.includes('saved')) return 'text-green-300'
    if (s.startsWith('[task') || s.includes('evaluating') || s.includes('running')) return 'text-blue-200'
    return 'text-gray-300'
  }
  return (
    <div ref={ref} className={`font-mono text-[11px] leading-4 bg-[#0a0d12] border border-ink-line rounded-md p-3 overflow-auto ${maxHeight}`}>
      {lines.length === 0 ? <span className="text-gray-500">{placeholder}</span>
        : lines.map((l, i) => <div key={i} className={`whitespace-pre ${tone(l)}`}>{l || ' '}</div>)}
    </div>
  )
}
