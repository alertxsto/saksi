import type { ReactNode } from 'react'
import { Avatar, IconChevron, TamperPill } from '@/components/citizen/ReceiptRows'
import { DotIcon } from '@/components/ui/DotIcon'
import { IconCheck, IconDownload, IconTrash } from '@/components/ui/icons'
import { timeAgo } from '@/lib/format'
import type { AccessTotals, ControllerAccess } from './access'

const KIND = ['Read', 'Update', 'Export', 'Shared'] as const

function lastSeen(at: string, now: number): string {
  if (!now) return 'last access —'
  const t = timeAgo(at, now)
  return t === 'just now' ? 'last access just now' : `last ${t}`
}

/** Grouped section (riset-ui/35): sans 15/600 title above, optional one-line lead, content in an inset card. */
export function ProfileGroup({ id, title, lead, children }: { id: string; title: string; lead?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <div className="px-1">
        <h2 id={id} className="text-[15px] font-semibold text-ink">
          {title}
        </h2>
        {lead ? <p className="mt-0.5 text-[14px] leading-snug text-ink-2">{lead}</p> : null}
      </div>
      {children}
    </section>
  )
}

const card = 'overflow-hidden rounded-lg border border-line bg-card'

/** Receipts · Companies · Verified as one inset card. */
export function AccessTotalsStrip({ totals }: { totals: AccessTotals }) {
  const cells: Array<[string, number, ReactNode]> = [
    ['Receipts', totals.receipts, 'in this profile'],
    ['Companies', totals.controllers, 'with access'],
    ['Verified', totals.verified, totals.altered ? <span className="text-bad">{totals.altered} altered</span> : 'by your phone'],
  ]
  return (
    <dl className={`grid grid-cols-3 ${card}`}>
      {cells.map(([label, value, sub], i) => (
        <div key={label} className={`flex min-w-0 flex-col px-4 py-3.5 ${i ? 'border-l border-line' : ''}`}>
          <dt className="text-[13px] text-ink-2">{label}</dt>
          <dd className="tnum mt-1 text-[24px] font-semibold leading-none tracking-[-0.02em] text-ink">{value}</dd>
          <dd className="mt-1.5 truncate text-[13px] text-ink-3">{sub}</dd>
        </div>
      ))}
    </dl>
  )
}

/** One row per company that opened this profile's data, counted from the receipts themselves. */
export function AccessList({ rows, now }: { rows: ControllerAccess[]; now: number }) {
  if (rows.length === 0) {
    return (
      <div className={`flex items-center gap-3.5 p-4 ${card}`}>
        <DotIcon name="eye" size={28} className="shrink-0 text-ink-3" />
        <p className="text-[15px] leading-snug text-ink-2">No company has opened your data yet. Each access shows up here, counted from your receipts.</p>
      </div>
    )
  }
  return (
    <ul className={`cz-group ${card}`}>
      {rows.map((r) => (
        <li key={r.controllerId} className="flex min-h-16 items-center gap-3 pl-4">
          <Avatar name={r.name} tone={r.altered ? 'bad' : 'neutral'} />
          <div className="cz-row-main flex min-w-0 flex-1 items-center gap-3 self-stretch py-3 pr-4">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[16px] font-medium leading-snug text-ink">{r.name}</p>
              <p className="mt-0.5 text-[14px] leading-snug text-ink-2">
                {r.count} {r.count === 1 ? 'access' : 'accesses'} · {lastSeen(r.lastAt, now)}
              </p>
              <p className="mt-0.5 text-[13px] text-ink-3">
                {KIND.map((k, i) => (r.kinds[i] ? `${k} ${r.kinds[i]}` : null))
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
            {r.altered ? (
              <TamperPill>{`${r.altered} altered`}</TamperPill>
            ) : r.match === r.count ? (
              <span className="flex items-center gap-1 text-[13px] font-medium text-ok">
                <IconCheck size={14} strokeWidth={2.6} aria-hidden="true" /> All verified
              </span>
            ) : r.match ? (
              <span className="text-[13px] text-ink-3">
                {r.match} of {r.count} verified
              </span>
            ) : (
              <span className="text-[13px] text-ink-3">Not checked yet</span>
            )}
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
    <ol className={card}>
      {RIGHTS.map(([art, right, how], i) => (
        <li key={art} className={`flex items-start gap-4 px-4 py-3 ${i ? 'border-t border-line' : ''}`}>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-medium leading-snug text-ink">{right}</span>
            <span className="mt-0.5 block text-[14px] leading-snug text-ink-2">{how}</span>
          </span>
          <span className="tnum shrink-0 pt-0.5 text-[13px] text-ink-3">Art. {art}</span>
        </li>
      ))}
    </ol>
  )
}

/** Data actions: download first, the destructive one last in red text. One action per row. */
export function DataActions({
  count,
  onDownloadAll,
  onAskDelete,
}: {
  count: number
  onDownloadAll?: () => void
  onAskDelete: () => void
}) {
  const canDownload = count > 0 && !!onDownloadAll
  return (
    <div className={card}>
      <button
        type="button"
        onClick={onDownloadAll}
        disabled={!canDownload}
        className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-paper-2/50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-paper-2 text-ink">
          <IconDownload size={17} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[16px] font-medium leading-snug text-ink">Download all receipts</span>
          <span className="mt-0.5 block text-[14px] leading-snug text-ink-2">
            {count === 0 ? 'Nothing to download yet' : `One JSON file · ${count} ${count === 1 ? 'receipt' : 'receipts'} · re-check any at /proof`}
          </span>
        </span>
        <IconChevron size={16} className="shrink-0 text-ink-3" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={onAskDelete}
        className="flex min-h-16 w-full items-center gap-3 border-t border-line px-4 py-3 text-left transition-colors duration-150 hover:bg-bad-bg/40"
      >
        <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bad-bg text-bad">
          <IconTrash size={17} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[16px] font-medium leading-snug text-bad">Delete profile</span>
          <span className="mt-0.5 block text-[14px] leading-snug text-ink-2">Receipts leave our database. Sealed fingerprints stay on chain.</span>
        </span>
      </button>
    </div>
  )
}
