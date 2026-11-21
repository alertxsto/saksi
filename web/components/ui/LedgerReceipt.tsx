import type { ReactNode } from 'react'
import type { ReceiptOpening } from '@/lib/shared/types'
import { basisLabel, eventVerb, formatWIB } from '@/lib/format'
import { FingerprintChip } from './FingerprintChip'

export type LedgerRow = { k: string; v: ReactNode; strong?: boolean }

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
            <div key={r.k} className="flex min-h-11 items-center py-1.5 font-mono text-[13px]">
              <dt className="label shrink-0 text-[12px] text-ink-2">{r.k}</dt>
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

/** The citizen-facing receipt: WHO / DID / WHY / LEGAL BASIS / SEALED / FINGERPRINT. */
export function LedgerReceipt({ opening, header, footer }: { opening: ReceiptOpening; header?: ReactNode; footer?: ReactNode }) {
  return (
    <Ledger
      header={header}
      footer={footer}
      rows={[
        { k: 'WHO', v: opening.controllerName },
        { k: 'DID', v: eventVerb(opening.eventType), strong: true },
        { k: 'WHY', v: opening.purposeText },
        { k: 'LEGAL BASIS', v: basisLabel(opening.legalBasisKey) },
        { k: 'SEALED', v: opening.status === 'anchored' ? formatWIB(opening.createdAt) : 'sealing on chain…' },
        { k: 'FINGERPRINT', v: <FingerprintChip value={opening.txHash} /> },
      ]}
    />
  )
}
