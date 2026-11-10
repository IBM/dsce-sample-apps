import { cn } from '@/lib/utils'

export function BobMark({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-1.5', className)}>
      <img src="/logos/ibm.svg" alt="IBM" className="h-[1em] w-auto" />
      <span className="font-semibold tracking-tight text-foreground">Bob</span>
    </span>
  )
}

export function BoxMark({ className }: { className?: string }) {
  return <img src="/logos/box.svg" alt="Box" className={cn('h-[1.4em] w-auto', className)} />
}

export function BrandLockup({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-2', className)}>
      <BobMark />
      <span aria-hidden="true" className="text-muted-foreground">
        {'×'}
      </span>
      <BoxMark />
    </span>
  )
}
