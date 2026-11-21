'use client'

import { useEffect, useRef, useState } from 'react'
import { RollNumber } from './RollNumber'

export type StatTone = 'ink' | 'ok' | 'bad' | 'pending'

export type Stat = {
  label: string
  value: number | null
  hint: string
  tone?: StatTone
  /** Tamper only: the number itself turns red and the column flashes when it goes up. */
  alarm?: boolean
}

const DOT: Record<StatTone, string> = { ink: 'bg-ink', ok: 'bg-ok', bad: 'bg-bad', pending: 'bg-pending' }

/**
 * KPI row in the landing grammar (Mobbin S4): label over a big rolling Doto value, columns split by
 * hairlines, no boxes. Colour lives on a 6 px status dot; only an `alarm` stat (ALTERED / DELETED with
 * a count above zero) turns its number red, and it flashes once each time the count rises.
 */
export function StatRow({
  stats,
  size = 'lg',
  label,
  intro = false,
}: {
  stats: Stat[]
  size?: 'lg' | 'xl'
  label: string
  /** Roll the numbers up from 0 on first paint (Watch only). */
  intro?: boolean
}) {
  return (
    <dl
      aria-label={label}
      className={`grid border-y border-line ${stats.length === 4 ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-1 sm:grid-cols-3'}`}
    >
      {stats.map((s, i) => (
        <StatCell key={s.label} s={s} i={i} n={stats.length} size={size} intro={intro} />
      ))}
    </dl>
  )
}

function StatCell({ s, i, n, size, intro }: { s: Stat; i: number; n: number; size: 'lg' | 'xl'; intro: boolean }) {
  const hot = !!s.alarm && (s.value ?? 0) > 0
  const prev = useRef(s.value)
  const [pulse, setPulse] = useState(0)
  useEffect(() => {
    if (s.alarm && s.value !== null && prev.current !== null && s.value > prev.current) setPulse((p) => p + 1)
    prev.current = s.value
  }, [s.value, s.alarm])

  // hairlines: every column but the first gets a left rule; in the 2-up grid the second row gets a top rule
  const rules =
    n === 4
      ? ['pl-0 pr-4', 'border-l pl-5 pr-4', 'border-t pl-0 pr-4 lg:border-l lg:border-t-0 lg:pl-6', 'border-l border-t pl-5 pr-4 lg:border-t-0 lg:pl-6'][i]
      : i === 0
        ? 'pr-6'
        : 'border-t sm:border-l sm:border-t-0 sm:px-6'

  return (
    <div className={`rg-stat relative flex flex-col gap-3 overflow-hidden border-line py-6 ${rules}`} data-hot={hot || undefined}>
      {pulse ? <span key={pulse} aria-hidden="true" className="rg-stat-flash pointer-events-none absolute inset-0" /> : null}
      <dt className="relative flex items-center gap-2">
        <span aria-hidden="true" className={`size-1.5 rounded-full ${DOT[s.tone ?? 'ink']}`} />
        <span className={`label text-[12px] ${hot ? 'text-bad' : 'text-ink-2'}`}>{s.label}</span>
      </dt>
      <dd className="relative">
        <RollNumber
          value={s.value}
          intro={intro}
          className={`${size === 'xl' ? 'text-[56px] md:text-[64px] lg:text-[72px]' : 'text-[48px] md:text-[64px]'} ${hot ? 'text-bad' : 'text-ink'}`}
        />
        <p className="mt-3 font-mono text-[12px] text-ink-2">{s.hint}</p>
      </dd>
    </div>
  )
}
