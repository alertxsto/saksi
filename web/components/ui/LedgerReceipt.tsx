import type { ReactNode } from 'react'
import type { ReceiptOpening } from '@/lib/shared/types'
import { basisLabel, eventVerb, formatWIB } from '@/lib/format'
import { alteredFields, controllerAltered, IDLE, sealedEventType, type ReceiptCheck } from '@/lib/receipt-state'
import { FingerprintChip } from './FingerprintChip'
import { IconX } from './icons'

/** `altered`: the chain check proved this database value wrong; the row is flagged red. */
export type LedgerRow = { k: string; v: ReactNode; strong?: boolean; altered?: boolean }

/** Mono receipt with dot leaders and perforated top/bottom edges. */
export function Ledger({
  rows,
  header,
  footer,
  className = '',
}: {
  rows: LedgerRow[]
  header?: ReactNode
  footer?: ReactNode
  className?: string
}) {
  return (
    <div className={`relative ${className}`}>
      <div aria-hidden="true" className="perf-top h-2 bg-card" />
      <div className="bg-card px-5 pb-5 pt-3 sm:px-6">
        {header ? <div className="mb-3 border-b border-dashed border-line-strong pb-3">{header}</div> : null}
        <dl className="flex flex-col">
          {rows.map((r) => (
            <div
              key={r.k}
              className={`flex min-h-11 items-center py-1.5 font-mono text-[13px] ${r.altered ? '-mx-2 rounded-sm bg-bad-bg px-2' : ''}`}
            >
              <dt className={`label flex shrink-0 items-center gap-1 text-[12px] ${r.altered ? 'text-bad' : 'text-ink-2'}`}>
                {r.altered ? <IconX size={12} strokeWidth={2.6} aria-hidden="true" /> : null}
                {r.k}
                {r.altered ? <span className="sr-only"> (altered)</span> : null}
              </dt>
              <span aria-hidden="true" className="leader self-center text-ink-3" />
              <dd className={`min-w-0 text-right ${r.strong ? 'font-bold text-ink' : 'text-ink'}`}>{r.v}</dd>
            </div>
          ))}
        </dl>
        {footer ? <div className="mt-3 border-t border-dashed border-line-strong pt-3">{footer}</div> : null}
      </div>
      <div aria-hidden="true" className="perf-bottom h-2 bg-card" />
    </div>
  )
}

/** Database value proven wrong by the chain: struck through, with what the chain sealed when it is readable. */
function Altered({ db, chain }: { db: ReactNode; chain?: string }) {
  return (
    <span className="flex flex-col items-end gap-0.5">
      <span className="text-bad line-through decoration-2">{db}</span>
      <span className="label text-[11px] text-bad">{chain ? `CHAIN SEALED · ${chain}` : 'CHANGED AFTER SEALING'}</span>
    </span>
  )
}

/**
 * The citizen-facing receipt: WHO / DID / WHY / LEGAL BASIS / SEALED / FINGERPRINT. These are the database's
 * values; pass `check` so rows the chain check proved wrong are flagged instead of shown as fact.
 */
export function LedgerReceipt({
  opening,
  header,
  footer,
  check = IDLE,
}: {
  opening: ReceiptOpening
  header?: ReactNode
  footer?: ReactNode
  check?: ReceiptCheck
}) {
  const altered = alteredFields(check)
  const sealed = sealedEventType(check)
  const who = controllerAltered(opening, check)
  return (
    <Ledger
      header={header}
      footer={footer}
      rows={[
        { k: 'WHO', v: who ? <Altered db={opening.controllerName} /> : opening.controllerName, altered: who },
        {
          k: 'DID',
          v: altered.has('eventType') ? (
            <Altered db={eventVerb(opening.eventType)} chain={sealed !== null ? eventVerb(sealed) : undefined} />
          ) : (
            eventVerb(opening.eventType)
          ),
          strong: true,
          altered: altered.has('eventType'),
        },
        {
          k: 'WHY',
          v: altered.has('purpose') ? <Altered db={opening.purposeText} /> : opening.purposeText,
          altered: altered.has('purpose'),
        },
        {
          k: 'LEGAL BASIS',
          v: altered.has('legalBasis') ? <Altered db={basisLabel(opening.legalBasisKey)} /> : basisLabel(opening.legalBasisKey),
          altered: altered.has('legalBasis'),
        },
        { k: 'SEALED', v: opening.status === 'anchored' ? formatWIB(opening.createdAt) : 'sealing on chain…' },
        { k: 'FINGERPRINT', v: <FingerprintChip value={opening.txHash} /> },
      ]}
    />
  )
}
