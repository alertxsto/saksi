import type { ReactNode } from 'react'
import { Heading } from '@/components/landing/Words'

/**
 * Console page head (BreachClock layout): two-tone word-rise headline on the left, a short plain
 * paragraph on the right, a hairline under both. No eyebrow, no chips pile.
 */
export function ConsoleHead({ lead, tail, children, aside }: { lead: string; tail: string; children?: ReactNode; aside?: ReactNode }) {
  return (
    <header className="grid gap-6 border-b border-line pb-8 lg:grid-cols-12 lg:items-end lg:pb-10">
      <Heading as="h1" lead={lead} tail={tail} className="text-[34px] leading-[1.04] md:text-[56px] lg:col-span-7" />
      <div className="flex flex-col gap-4 lg:col-span-4 lg:col-start-9">
        {children ? <p className="max-w-[46ch] text-[16px] leading-[1.6] tracking-[0.01em] text-ink-2 md:text-[17px]">{children}</p> : null}
        {aside}
      </div>
    </header>
  )
}

/** Mono meta line with hairline separators: HASH ONLY ON CHAIN | NO NAMES (landing hero footer style). */
export function MetaLine({ items }: { items: ReactNode[] }) {
  return (
    <p className="label flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-ink-2">
      {items.map((it, i) => (
        <span key={i} className="flex items-center gap-3">
          {i ? <span aria-hidden="true" className="h-3 w-px bg-line-strong" /> : null}
          {it}
        </span>
      ))}
    </p>
  )
}
