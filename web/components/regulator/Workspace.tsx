'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { IconArrow, IconCheck } from '@/components/ui/icons'
import { Skeleton } from '@/components/ui/Skeleton'
import '@/app/regulator/regulator.css'

const WIB = 'Asia/Jakarta'

/** "21 Nov 13:16" in WIB, the plain-words date used across the regulator workspace. */
export function plainTime(at: string | number): string {
  const d = new Date(at)
  const date = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: WIB })
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: WIB })
  return `${date} ${time}`
}
/** "21 Nov 2026" in WIB. */
export function plainDate(at: string | number): string {
  return new Date(at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: WIB })
}
/** "Sealed on the public ledger · 21 Nov 13:16" (seconds since epoch, as the chain gives it). */
export const sealedPhrase = (sec: number | null) =>
  sec === null ? 'Not sealed on the public ledger yet' : `Sealed on the public ledger · ${plainTime(sec * 1000)}`

export function ago(at: string | number, now: number): string {
  const s = Math.max(0, Math.round((now - new Date(at).getTime()) / 1000))
  if (s < 60) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} h ago`
  return `${Math.round(h / 24)} d ago`
}

/** Workspace page header: title 28/600 (large title on phones), one line of description, action on the right. */
export function PageHeader({ title, desc, action }: { title: string; desc: ReactNode; action?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        <h1 className="text-[32px] font-semibold leading-[1.1] tracking-[-0.025em] text-ink lg:text-[28px] lg:tracking-[-0.02em]">{title}</h1>
        <p className="mt-1.5 max-w-[72ch] text-[15px] leading-relaxed text-ink-2">{desc}</p>
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </header>
  )
}

/** Count-up on first load, at most 600 ms, ease-out. Instant under reduced motion. */
export function useCountUp(target: number | null, ms = 600): number | null {
  const [v, setV] = useState<number | null>(target === null ? null : 0)
  const done = useRef(false)
  useEffect(() => {
    if (target === null) return
    if (done.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      done.current = true
      setV(target)
      return
    }
    let raf = 0
    const t0 = performance.now()
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / ms)
      setV(Math.round(target * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(tick)
      else done.current = true
    }
    raf = requestAnimationFrame(tick)
    // rAF pauses in hidden or throttled tabs: always land on the real number.
    const settle = window.setTimeout(() => {
      cancelAnimationFrame(raf)
      done.current = true
      setV(target)
    }, ms + 80)
    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(settle)
    }
  }, [target, ms])
  return target === null ? null : v
}

export type KpiTone = 'ink' | 'bad' | 'pending' | 'ok'
const KPI_TONE: Record<KpiTone, string> = { ink: 'text-ink', bad: 'text-bad', pending: 'text-pending', ok: 'text-ok' }

/** One calm KPI tile: Geist tabular numbers, no tickers. `value` null = still loading (or unknown: `unknown`). */
export function Kpi({
  label,
  value,
  unit,
  hint,
  tone = 'ink',
  unknown,
}: {
  label: string
  value: number | null
  unit?: string
  hint: ReactNode
  tone?: KpiTone
  unknown?: boolean
}) {
  const shown = useCountUp(unknown ? null : value)
  return (
    <div className="flex min-w-0 flex-col rounded-lg border border-line bg-card px-4 py-4 lg:px-5">
      <span className="text-[13px] text-ink-2">{label}</span>
      {unknown ? (
        <span className="tnum mt-2 text-[32px] font-semibold leading-none tracking-[-0.02em] text-ink-3">—</span>
      ) : shown === null ? (
        <Skeleton className="mt-2 h-8 w-16" />
      ) : (
        <span className={`tnum mt-2 text-[32px] font-semibold leading-none tracking-[-0.02em] ${KPI_TONE[tone]}`}>
          {shown.toLocaleString('en-US')}
          {unit ? <span className="ml-1.5 text-[15px] font-medium tracking-normal text-ink-2">{unit}</span> : null}
        </span>
      )}
      <span className="mt-2 text-[13px] leading-snug text-ink-3">{hint}</span>
    </div>
  )
}

/** Hashes, blocks and log indexes live only here: a quiet disclosure that starts collapsed. */
export function TechnicalProof({ children, label = 'Show technical proof' }: { children: ReactNode; label?: string }) {
  return (
    <details className="rg2-proof group border-t border-line">
      <summary className="flex min-h-11 items-center gap-2 text-[13px] text-ink-2 hover:text-ink">
        <IconArrow size={13} className="rg2-caret" />
        <span>{label}</span>
      </summary>
      <div className="pb-2">
        <dl className="flex flex-col">{children}</dl>
      </div>
    </details>
  )
}

export function ProofRow({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="flex min-h-10 items-center justify-between gap-4 border-t border-line/70 py-1.5 first:border-t-0">
      <dt className="shrink-0 text-[13px] text-ink-3">{k}</dt>
      <dd className="flex min-w-0 items-center justify-end gap-1 text-right font-mono text-[13px] text-ink-2">{children}</dd>
    </div>
  )
}

/** Fact row inside a ticket or sheet: label left (ink-2), value right. */
export function Fact({ k, children, tone }: { k: string; children: ReactNode; tone?: 'bad' | 'pending' | 'ok' }) {
  const t = tone === 'bad' ? 'text-bad font-medium' : tone === 'pending' ? 'text-pending font-medium' : tone === 'ok' ? 'text-ok' : 'text-ink'
  return (
    <div className="grid grid-cols-[minmax(96px,34%)_minmax(0,1fr)] items-baseline gap-4 border-t border-line py-3 first:border-t-0">
      <dt className="text-[14px] text-ink-2">{k}</dt>
      <dd className={`min-w-0 break-words text-right text-[15px] leading-snug ${t}`}>{children}</dd>
    </div>
  )
}

export type Standing = { label: string; tone: 'ok' | 'bad' | 'pending' | 'neutral' | 'muted'; note: string }

const STANDING_CLS: Record<Standing['tone'], string> = {
  ok: 'text-ok',
  bad: 'bg-bad-bg text-bad border-bad/25',
  pending: 'bg-pending-bg text-pending border-pending/25',
  neutral: 'bg-card text-ink border-line-strong',
  muted: 'bg-paper-2 text-ink-2 border-line',
}

/** Plain-language compliance chip. Good standing is text + check (never a solid green: that is the regulator accent). */
export function StandingChip({ s, className = '' }: { s: Standing; className?: string }) {
  if (s.tone === 'ok') {
    return (
      <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] font-medium text-ok ${className}`}>
        <IconCheck size={13} strokeWidth={2.6} /> {s.label}
      </span>
    )
  }
  return (
    <span className={`inline-flex h-7 items-center whitespace-nowrap rounded-pill border px-2.5 text-[13px] font-medium ${STANDING_CLS[s.tone]} ${className}`}>
      {s.label}
    </span>
  )
}

/** Neutral block for empty and error states: one sentence, one action. Never red. */
export function Calm({ title, body, action, icon }: { title: string; body?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="rg2-swap flex flex-col items-start gap-3 rounded-lg border border-dashed border-line-strong px-5 py-8 lg:px-8">
      {icon ? <span className="flex size-10 items-center justify-center rounded-md bg-paper-2 text-ink-2">{icon}</span> : null}
      <div>
        <p className="text-[16px] font-medium text-ink">{title}</p>
        {body ? <p className="mt-1 max-w-[60ch] text-[14px] leading-relaxed text-ink-2">{body}</p> : null}
      </div>
      {action}
    </div>
  )
}

/** Keeps a set of ids seen in earlier renders, so rows that arrive later can be marked new. First load marks nothing. */
export function useArrivals(ids: string[] | null): Set<string> {
  const seen = useRef<Set<string> | null>(null)
  const [fresh, setFresh] = useState<Set<string>>(new Set())
  const key = ids ? ids.join('|') : null
  useEffect(() => {
    if (!ids) return
    if (!seen.current) {
      seen.current = new Set(ids)
      return
    }
    const added = ids.filter((id) => !seen.current!.has(id))
    ids.forEach((id) => seen.current!.add(id))
    if (added.length) setFresh((f) => new Set([...f, ...added]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return fresh
}
