import type { WatchRowView } from '@/lib/data'
import { shortHex } from '@/lib/format'
import { Badge, type StatusKind } from './Badge'
import { IconMinus, IconPlus } from './icons'

const KIND: Record<WatchRowView['status'], StatusKind> = {
  MATCH: 'MATCH',
  ALTERED: 'ALTERED',
  DELETED: 'DELETED',
  NOT_ANCHORED: 'NOT_ANCHORED',
}

const ORDER: Record<WatchRowView['status'], number> = { ALTERED: 0, DELETED: 1, NOT_ANCHORED: 2, MATCH: 3 }

/** Problem rows first (ALTERED on top), then by receipt number. */
export function sortWatch(rows: WatchRowView[]) {
  return [...rows].sort((a, b) => ORDER[a.status] - ORDER[b.status] || b.ref.localeCompare(a.ref))
}

/** Numbered watch table with a +/− diff for changed rows. */
export function WatchTable({
  rows,
  selected,
  onSelect,
  flashRef,
}: {
  rows: WatchRowView[]
  selected?: string | null
  onSelect?: (ref: string) => void
  flashRef?: string | null
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-card">
      <table className="w-full min-w-[700px] border-collapse text-left">
        <caption className="sr-only">Receipts compared: database versus chain</caption>
        <thead>
          <tr className="border-b border-line bg-paper">
            {['RECEIPT', 'CONTROLLER', 'DATABASE SAYS', 'CHAIN SEALED', 'STATUS'].map((h) => (
              <th key={h} scope="col" className="label px-4 py-3 text-[11px] font-normal text-ink-2">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const problem = r.status !== 'MATCH'
            const altered = r.status === 'ALTERED'
            // ALTERED and DELETED are proof of a change (red); NOT ANCHORED is pending (amber).
            const bad = altered || r.status === 'DELETED'
            const isSel = selected === r.ref
            return (
              <tr
                key={r.ref}
                className={`border-b border-line last:border-b-0 ${altered ? 'bg-bad-bg' : ''} ${
                  flashRef === r.ref ? 'anim-flash' : ''
                } ${isSel ? 'outline-2 -outline-offset-2 outline-ink' : ''}`}
              >
                <td className="px-4 py-3 align-top">
                  {onSelect ? (
                    <button
                      type="button"
                      onClick={() => onSelect(r.ref)}
                      className="-mx-2 -my-2 flex min-h-11 flex-col items-start justify-center px-2 text-left hover:text-blue"
                      aria-pressed={isSel}
                    >
                      <span className="tnum font-mono text-[14px] font-bold">{r.ref}</span>
                      <span className="whitespace-nowrap font-mono text-[11px] text-ink-2">{shortHex(r.txHash, 6, 4)}</span>
                    </button>
                  ) : (
                    <span className="tnum font-mono text-[14px] font-bold">{r.ref}</span>
                  )}
                </td>
                <td className="px-4 py-3 align-top text-[14px] text-ink">{r.controllerName.replace(' (fictional)', '').replace(' Co.', '')}</td>
                <td className="px-4 py-3 align-top">
                  {problem && r.dbValue ? (
                    <span className="flex items-start gap-2 font-mono text-[13px]">
                      <span
                        className={`mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded-sm ${bad ? 'bg-bad' : 'bg-pending'} text-white`}
                        aria-label="removed or changed"
                      >
                        <IconMinus size={11} strokeWidth={3} />
                      </span>
                      <span className={bad ? 'font-bold text-bad' : 'font-bold text-pending'}>
                        {r.field && r.field !== 'row' && r.field !== 'txHash' ? <span className="text-ink-2">{r.field}: </span> : null}
                        {r.dbValue}
                      </span>
                    </span>
                  ) : (
                    <span className="font-mono text-[13px] text-ink-2">same as chain</span>
                  )}
                </td>
                <td className="px-4 py-3 align-top">
                  {problem && r.chainValue ? (
                    <span className="flex items-start gap-2 font-mono text-[13px]">
                      <span
                        className="mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded-sm bg-ok text-white"
                        aria-label="sealed value"
                      >
                        <IconPlus size={11} strokeWidth={3} />
                      </span>
                      <span className="text-ink">
                        {r.field && r.field !== 'row' && r.field !== 'txHash' ? <span className="text-ink-2">{r.field}: </span> : null}
                        {r.chainValue}
                      </span>
                    </span>
                  ) : (
                    <span className="tnum font-mono text-[13px] text-ink-2">
                      {r.blockNumber ? `block ${r.blockNumber.toLocaleString('en-US')}` : '—'}
                    </span>
                  )}
                </td>
                <td className="w-px whitespace-nowrap px-4 py-3 align-top">
                  <Badge kind={KIND[r.status]} size="sm" />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
