import type { ReactNode } from 'react'
import Link from 'next/link'
import { FingerprintChip } from '@/components/ui/FingerprintChip'
import { IconArrowUpRight, IconCheck, IconClock, IconSpinner, IconX } from '@/components/ui/icons'
import { basisLabel, eventVerb, formatWIB, proofPath } from '@/lib/format'
import '@/app/citizen/witness.css'
import { alteredFields, controllerAltered, IDLE, sealedEventType, type ReceiptCheck, type ReceiptStateKind } from '@/lib/receipt-state'
import { DATA_CATEGORY_LABELS, type DataCategory, type ReceiptOpening } from '@/lib/shared/types'

const sentence = (s: string) => s.charAt(0) + s.slice(1).toLowerCase()

type Fact = { k: string; v: ReactNode; altered?: boolean }

/** A database value the chain check proved wrong: struck red, with what the chain sealed in green when known. */
function Changed({ db, chain }: { db: string; chain?: string }) {
  return (
    <span className="flex flex-col items-end gap-0.5 text-right">
      <span className="text-bad line-through decoration-[1.5px]">{db}</span>
      <span className={`text-[13px] font-medium ${chain ? 'text-ok' : 'text-bad'}`}>{chain ? `Sealed as: ${chain}` : 'Changed after sealing'}</span>
    </span>
  )
}

/**
 * The receipt as one inset key/value group (riset-ui/35 detail §4): the database's values, with any field
 * this browser's chain check proved wrong struck through next to what the chain sealed.
 */
export function ReceiptFacts({
  opening,
  check = IDLE,
  inset = false,
}: {
  opening: ReceiptOpening
  check?: ReceiptCheck
  /** Rows only, no card of their own: the facts sit inside the receipt ticket (no cards in cards). */
  inset?: boolean
}) {
  const altered = alteredFields(check)
  const sealed = sealedEventType(check)
  const whoChanged = controllerAltered(opening, check)
  const ev = opening.evidence as { system?: unknown; dataCategories?: unknown }
  const system = typeof ev.system === 'string' ? ev.system : null
  const categories = Array.isArray(ev.dataCategories) ? ev.dataCategories.filter((c): c is string => typeof c === 'string') : []
  const result = check.phase === 'done' ? check.result : null
  const block = result?.blockNumber ? result.blockNumber : null

  const facts: Fact[] = [
    {
      k: 'Action',
      v: altered.has('eventType') ? (
        <Changed db={sentence(eventVerb(opening.eventType))} chain={sealed !== null ? sentence(eventVerb(sealed)) : undefined} />
      ) : (
        sentence(eventVerb(opening.eventType))
      ),
      altered: altered.has('eventType'),
    },
    { k: 'Company', v: whoChanged ? <Changed db={opening.controllerName} /> : opening.controllerName, altered: whoChanged },
    { k: 'Purpose', v: altered.has('purpose') ? <Changed db={opening.purposeText} /> : opening.purposeText, altered: altered.has('purpose') },
    {
      k: 'Legal basis',
      v: altered.has('legalBasis') ? <Changed db={basisLabel(opening.legalBasisKey)} /> : basisLabel(opening.legalBasisKey),
      altered: altered.has('legalBasis'),
    },
  ]
  if (system || categories.length) {
    const named = categories.map((c) => DATA_CATEGORY_LABELS[c as DataCategory] ?? c).join(', ')
    const text = [named, system].filter(Boolean).join(' · ')
    facts.push({ k: 'Data used', v: altered.has('evidence') ? <Changed db={text} /> : text, altered: altered.has('evidence') })
  }
  facts.push({
    k: 'Sealed',
    v:
      opening.status === 'anchored' ? (
        `On the public ledger · ${formatWIB(opening.createdAt)}`
      ) : opening.status === 'failed' ? (
        <span className="text-ink-3">Not sealed</span>
      ) : (
        <span className="text-pending">Sealing on the public ledger…</span>
      ),
  })

  // Chain data is secondary (riset-ui/37 §2): block, fingerprint and confirmations sit in a collapsed group.
  const tech: Fact[] = [{ k: 'Fingerprint', v: <FingerprintChip value={opening.txHash} /> }]
  if (block) tech.push({ k: 'Block', v: <span className="tnum font-mono text-[13px]">{Number(block).toLocaleString('en-US')}</span> })
  if (result?.confirmations !== undefined)
    tech.push({ k: 'Confirmations', v: <span className="tnum font-mono text-[13px]">{result.confirmations.toLocaleString('en-US')}</span> })
  if (result) tech.push({ k: 'Check took', v: <span className="tnum font-mono text-[13px]">{(result.elapsedMs / 1000).toFixed(2)} s</span> })
  if (result?.rpc) tech.push({ k: 'Node', v: <span className="break-all font-mono text-[13px]">{result.rpc}</span> })
  if (opening.logIndex !== null && opening.txHash) tech.push({ k: 'Log index', v: <span className="tnum font-mono text-[13px]">{opening.logIndex}</span> })

  const pad = inset ? 'px-5' : 'px-4'
  const rule = inset ? 'border-t border-line/70' : 'border-t border-line'
  return (
    <div className={inset ? '' : 'overflow-hidden rounded-lg border border-line bg-card'}>
      <dl>
        {facts.map((f, i) => (
          <div key={f.k} className={`flex min-h-12 items-center gap-4 py-2.5 ${pad} ${i ? rule : ''} ${f.altered ? 'bg-bad-bg/60' : ''}`}>
            <dt className={`flex shrink-0 items-center gap-1.5 text-[14px] ${f.altered ? 'font-medium text-bad' : 'text-ink-2'}`}>
              {f.altered ? <IconX size={12} strokeWidth={2.6} aria-hidden="true" /> : null}
              {f.k}
              {f.altered ? <span className="sr-only"> (altered)</span> : null}
            </dt>
            <dd className="ml-auto min-w-0 break-words text-right text-[15px] text-ink">{f.v}</dd>
          </div>
        ))}
      </dl>
      <details className={`wt-proof ${rule}`}>
        <summary className={`flex min-h-12 cursor-pointer items-center gap-2 py-2.5 ${pad} text-[14px] text-ink-2 transition-colors duration-150 hover:text-ink`}>
          <svg aria-hidden="true" className="wt-chev shrink-0 text-ink-3" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m9 6 6 6-6 6" />
          </svg>
          Technical proof
          <span className="ml-auto text-[13px] text-ink-3">For auditors</span>
        </summary>
        <div className="pb-2">
          <dl>
            {tech.map((f) => (
              <div key={f.k} className={`flex min-h-10 items-center gap-4 py-1.5 ${pad}`}>
                <dt className="shrink-0 text-[13px] text-ink-3">{f.k}</dt>
                <dd className="ml-auto min-w-0 break-words text-right text-[13px] text-ink">{f.v}</dd>
              </div>
            ))}
          </dl>
          {opening.txHash ? (
            <Link href={proofPath(opening)} className={`flex min-h-10 w-fit items-center gap-1.5 ${pad} text-[13px] font-medium text-ink-2 hover:text-blue`}>
              Re-check this seal at /proof <IconArrowUpRight size={13} />
            </Link>
          ) : null}
        </div>
      </details>
    </div>
  )
}

const STATUS: Record<ReceiptStateKind, { text: string; cls: string; icon: ReactNode }> = {
  MATCH: { text: 'Matches the sealed record', cls: 'bg-ok-bg text-ok', icon: <IconCheck size={14} strokeWidth={2.6} /> },
  ALTERED: { text: 'Changed after sealing', cls: 'bg-bad-bg text-bad', icon: <IconX size={13} strokeWidth={2.6} /> },
  ON_CHAIN: { text: 'Sealing…', cls: 'bg-pending-bg text-pending', icon: <IconClock size={14} /> },
  CHECKING: { text: 'Your phone is checking…', cls: 'bg-paper-2 text-ink-2', icon: <IconSpinner size={13} /> },
  NOT_FOUND: { text: 'Seal not found on this node yet', cls: 'bg-unknown-bg text-unknown', icon: <IconClock size={14} /> },
  RECORDED: { text: 'Recorded · not checked yet', cls: 'bg-paper-2 text-ink-2', icon: <IconClock size={14} /> },
  FAILED: { text: 'Not sealed', cls: 'bg-unknown-bg text-unknown', icon: <IconClock size={14} /> },
}

/** The one status line under the detail hero. Red only for ALTERED. */
export function ReceiptStatusPill({ kind }: { kind: ReceiptStateKind }) {
  const s = STATUS[kind]
  return (
    <span aria-live="polite" className={`inline-flex h-8 w-fit items-center gap-1.5 rounded-pill px-3 text-[14px] font-medium ${s.cls}`}>
      <span aria-hidden="true">{s.icon}</span>
      {s.text}
    </span>
  )
}
