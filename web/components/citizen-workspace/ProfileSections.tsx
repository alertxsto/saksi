import type { ReactNode } from 'react'
import { EVENT_GLYPH } from '@/components/citizen/ReceiptRows'
import { DotIcon } from '@/components/ui/DotIcon'
import { DotoValue } from '@/components/ui/DotoValue'
import { IconCheck } from '@/components/ui/icons'
import { timeAgo } from '@/lib/format'
import type { AccessTotals, ControllerAccess } from './access'

const KIND = ['READ', 'UPDATE', 'EXPORT', 'SHARED'] as const

/** Section on the paper: sub-heading, one calm line, content. Hairline above, no box. */
export function ProfileSection({ id, title, lead, children, action }: { id: string; title: string; lead?: ReactNode; children: ReactNode; action?: ReactNode }) {
  return (
    <section aria-labelledby={id} className="border-t border-line pt-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 id={id} className="text-[19px] font-medium leading-snug tracking-[-0.015em] text-ink @xl/side:text-[22px]">
            {title}
          </h2>
          {lead ? <p className="mt-1 text-[15px] leading-[1.6] tracking-[0.01em] text-ink-2">{lead}</p> : null}
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  )
}

/** Receipts · Companies · Verified, as Doto numbers in a hairline strip. */
export function AccessTotalsStrip({ totals }: { totals: AccessTotals }) {
  const cells: Array<[string, number, ReactNode]> = [
    ['Receipts', totals.receipts, 'in this profile'],
    ['Companies', totals.controllers, 'with access'],
    [
      'Verified',
      totals.verified,
      totals.altered ? <span className="text-bad">{totals.altered} altered</span> : 'by your phone',
    ],
  ]
  return (
    <dl className="grid grid-cols-3 border-y border-line">
      {cells.map(([label, value, sub], i) => (
        <div key={label} className={`flex min-w-0 flex-col gap-2 px-3 py-4 first:pl-0 ${i ? 'border-l border-line' : ''}`}>
          <dt className="label text-[11px] text-ink-2">{label}</dt>
          <dd className="text-[40px] leading-[0.9] text-ink @xl/side:text-[48px]">
            <DotoValue value={String(value).padStart(2, '0')} />
          </dd>
          <dd className="truncate font-mono text-[11px] text-ink-2">{sub}</dd>
        </div>
      ))}
    </dl>
  )
}

/** One row per company that opened this profile's data, from the receipts themselves. */
export function AccessList({ rows, now }: { rows: ControllerAccess[]; now: number }) {
  if (rows.length === 0) {
    return (
      <div className="flex items-center gap-3.5 border-y border-line py-5">
        <DotIcon name="eye" size={28} className="shrink-0 text-ink-3" />
        <p className="text-[15px] leading-[1.6] text-ink-2">No company has opened your data yet. Each access shows up here, counted from your receipts.</p>
      </div>
    )
  }
  return (
    <ul data-stagger="" className="-mt-1 flex flex-col">
      {rows.map((r) => (
        <li key={r.controllerId} className="flex gap-3.5 border-b border-line py-4">
          <span
            aria-hidden="true"
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-md ${
              r.altered ? 'bg-bad-bg text-bad' : r.kinds[3] ? 'bg-vault text-ice' : 'bg-paper-2 text-ink'
            }`}
          >
            <DotIcon name={r.altered ? 'cross' : (EVENT_GLYPH[r.lastType] ?? 'eye')} size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-3">
              <p className="truncate text-[15px] font-medium leading-snug text-ink">{r.name}</p>
              <p className="label tnum shrink-0 text-[11px] text-ink-2">
                {r.count} {r.count === 1 ? 'access' : 'accesses'}
              </p>
            </div>
            <p className="mt-0.5 font-mono text-[12px] text-ink-2">Last {now ? timeAgo(r.lastAt, now) : '—'}</p>
            <ul aria-label="Kinds of access" className="mt-2.5 flex flex-wrap gap-1.5">
              {KIND.map((k, i) =>
                r.kinds[i] ? (
                  <li
                    key={k}
                    className={`inline-flex h-6 items-center gap-1.5 rounded-pill border px-2 font-mono text-[11px] font-medium tracking-[0.03em] ${
                      i === 3 ? 'border-ink/25 text-ink' : 'border-line-strong text-ink-2'
                    }`}
                  >
                    {k}
                    <span className="tnum text-ink-3">×{r.kinds[i]}</span>
                  </li>
                ) : null,
              )}
            </ul>
            <p className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[12px]">
              {r.match ? (
                <span className="flex items-center gap-1 text-ok">
                  <IconCheck size={13} strokeWidth={2.4} /> {r.match} match the chain
                </span>
              ) : null}
              {r.altered ? (
                <span className="flex items-center gap-1.5 font-medium text-bad">
                  <DotIcon name="cross" size={12} /> {r.altered} altered
                </span>
              ) : null}
              {r.open ? <span className="text-ink-2">{r.open} not checked yet</span> : null}
            </p>
          </div>
        </li>
      ))}
    </ul>
  )
}

/** UU PDP (Law 27/2022) data-subject rights, Art. 5–13, and what a receipt adds to each. */
const RIGHTS: Array<[number, string, string]> = [
  [5, 'Know how your data is used', 'Each receipt says who opened it, what they did and why.'],
  [6, 'Correct or update your data', 'Point to the exact access and record you want fixed.'],
  [7, 'See and get a copy of your data', 'Your receipts show which company holds what to ask for.'],
  [8, 'End processing and have it deleted', 'A receipt dated after your request shows they kept going.'],
  [9, 'Withdraw your consent', 'Receipts after the day you withdrew are your evidence.'],
  [10, 'Object to decisions made only by machines', 'The stated purpose shows when your data fed an automated check.'],
  [11, 'Delay or restrict processing', 'New receipts show whether access paused when you asked.'],
  [12, 'Sue for damages', 'A sealed receipt, or one that turned red, is evidence you can file.'],
  [13, 'Take your data to another service', 'Download every receipt as one file, below.'],
]

export function RightsList() {
  return (
    <ol className="flex flex-col border-t border-line">
      {RIGHTS.map(([art, right, how]) => (
        <li key={art} className="grid grid-cols-[64px_minmax(0,1fr)] gap-3 border-b border-line py-3.5">
          <span className="label tnum pt-[3px] text-[11px] text-ink-2">Art. {art}</span>
          <span className="min-w-0">
            <span className="block text-[15px] font-medium leading-snug text-ink">{right}</span>
            <span className="mt-0.5 block text-[14px] leading-relaxed text-ink-2">{how}</span>
          </span>
        </li>
      ))}
    </ol>
  )
}
