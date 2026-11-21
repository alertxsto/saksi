import type { ReactNode } from 'react'
import { DotoValue } from './DotoValue'

const tones = {
  ink: { bar: 'bg-ink', icon: 'bg-paper-2 text-ink' },
  ok: { bar: 'bg-ok', icon: 'bg-ok-bg text-ok' },
  bad: { bar: 'bg-bad', icon: 'bg-bad-bg text-bad' },
  pending: { bar: 'bg-pending', icon: 'bg-pending-bg text-pending' },
  unknown: { bar: 'bg-unknown', icon: 'bg-unknown-bg text-unknown' },
}

/** KPI tile with a Doto numeral. */
export function KpiTile({
  label,
  value,
  icon,
  tone = 'ink',
  hint,
  active,
}: {
  label: string
  value: number | string
  icon?: ReactNode
  tone?: keyof typeof tones
  hint?: string
  active?: boolean
}) {
  const t = tones[tone]
  return (
    <div className={`relative flex flex-col justify-between gap-5 overflow-hidden rounded-lg bg-card p-5 ${active ? 'outline-2 -outline-offset-2 outline-bad' : ''}`}>
      <span aria-hidden="true" className={`absolute left-0 top-0 h-[3px] w-10 ${t.bar}`} />
      <div className="flex items-center justify-between gap-2">
        <p className="label text-ink-2">{label}</p>
        {icon ? <span className={`flex h-7 w-7 items-center justify-center rounded-sm ${t.icon}`}>{icon}</span> : null}
      </div>
      <div>
        <DotoValue className="text-[56px] text-ink" value={typeof value === 'number' ? String(value).padStart(2, '0') : value} />
        {hint ? <p className="mt-2 font-mono text-[12px] text-ink-2">{hint}</p> : null}
      </div>
    </div>
  )
}
