'use client'

import type { CSSProperties, ReactNode } from 'react'
import { initials } from '@/components/citizen/ReceiptRows'
import { IconCheck, IconClock, IconShield, IconX } from '@/components/ui/icons'
import { basisLabel, formatWIB, shortHex } from '@/lib/format'
import { receiptHeadline, type ReceiptCheck } from '@/lib/receipt-state'
import { EVENT_LABELS, EVENT_TYPES, type EventTypeName, type ReceiptOpening, type VerifyResult } from '@/lib/shared/types'
import { ProofStamp } from './ProofStamp'
import '@/app/citizen/stub-ticket.css'
import './proof.css'

type Field = VerifyResult['mismatches'][number]['field']

const VERB = ['Read', 'Updated', 'Exported', 'Shared']
const TAIL = ['a citizen’s data', 'a citizen’s data', 'a citizen’s data', 'a citizen’s data with a third party']

const human = (v: string) => ((EVENT_TYPES as readonly string[]).includes(v) ? EVENT_LABELS[v as EventTypeName] : v)
const isHex = (v: string) => /^0x[0-9a-f]+$/i.test(v)

/** What the ledger sealed for a changed field, in words. Hash-only fields cannot be read back, only told apart. */
function sealedWords(field: Field, chain: string): string {
  switch (field) {
    case 'eventType':
      return human(chain)
    case 'legalBasis':
      return isHex(chain) ? basisLabel(chain) : chain
    case 'purpose':
      return 'A different purpose'
    case 'evidence':
      return 'Different evidence'
    case 'pseudonym':
      return `Another citizen · ${shortHex(chain)}`
    case 'contract':
      return isHex(chain) ? shortHex(chain) : chain
  }
}

/** Same reading as the citizen facts (ReceiptFacts): data categories · system. */
function evidenceSummary(e: Record<string, unknown> | null | undefined): string {
  const ev = (e ?? {}) as { system?: unknown; dataCategories?: unknown }
  const system = typeof ev.system === 'string' ? ev.system : null
  const categories = Array.isArray(ev.dataCategories) ? ev.dataCategories.filter((c): c is string => typeof c === 'string') : []
  const text = [categories.join(', '), system].filter(Boolean).join(' · ')
  return text || 'Evidence fingerprint'
}

type Row = { key: string; label: string; value: ReactNode; field?: Field; mono?: boolean }

function rows(opening: ReceiptOpening, sealedAt: string | null): Row[] {
  const name = EVENT_TYPES[opening.eventType]
  return [
    { key: 'action', label: 'Action', value: name ? EVENT_LABELS[name] : 'Unknown', field: 'eventType' },
    { key: 'agency', label: 'Agency', value: opening.controllerName },
    { key: 'purpose', label: 'Purpose', value: opening.purposeText, field: 'purpose' },
    { key: 'basis', label: 'Legal basis', value: basisLabel(opening.legalBasisKey), field: 'legalBasis' },
    { key: 'evidence', label: 'Data used', value: evidenceSummary(opening.evidence), field: 'evidence' },
    { key: 'citizen', label: 'Citizen', value: `Pseudonym ${shortHex(opening.subjectPseudonym)}`, field: 'pseudonym', mono: false },
    { key: 'recorded', label: 'Recorded', value: formatWIB(opening.createdAt) },
    ...(sealedAt ? [{ key: 'sealed', label: 'Sealed', value: sealedAt }] : []),
  ]
}

function StatusPill({ kind }: { kind: 'idle' | 'checking' | 'ok' | 'bad' | 'unknown' | 'error' }) {
  const map = {
    idle: ['bg-paper-2 text-ink-2', <IconShield key="i" size={14} />, 'Not checked yet'],
    checking: ['bg-blue-bg text-blue', <span key="i" className="size-1.5 rounded-full bg-blue" />, 'Checking the ledger…'],
    ok: ['bg-ok-bg text-ok', <IconCheck key="i" size={14} strokeWidth={2.4} />, 'Matches the sealed record'],
    bad: ['bg-bad-bg text-bad', <IconX key="i" size={14} strokeWidth={2.4} />, 'Changed after sealing'],
    unknown: ['bg-unknown-bg text-unknown', <IconClock key="i" size={14} />, 'Not found on this node yet'],
    error: ['bg-unknown-bg text-unknown', <IconClock key="i" size={14} />, 'Nothing decided yet'],
  } as const
  const [cls, icon, label] = map[kind]
  return (
    <span className={`inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 text-[14px] font-medium ${cls}`}>
      {icon}
      {label}
    </span>
  )
}

/**
 * The receipt opened from a link or file, as the citizen's ticket (riset-ui/36 A, stub-ticket.css): who, the
 * verb as big type, one status, a perforation, the facts. The stamp lands on it once the stepper has finished:
 * MATCH green, ALTERED red with the changed rows flagged inline. NOT FOUND gets no stamp (grey pill).
 * Until this browser has checked, the link's contents are untrusted: no verdict colour anywhere.
 */
export function ProofTicket({ opening, check }: { opening: ReceiptOpening; check: ReceiptCheck }) {
  const head = receiptHeadline(opening, check)
  const result = check.phase === 'done' ? check.result : null
  const altered = result?.status === 'MISMATCH'
  const matched = result?.status === 'MATCH'
  const changed = new Map((altered ? result.mismatches : []).map((m) => [m.field, m]))
  const contract = changed.get('contract')
  const pill = check.phase === 'running' ? 'checking' : check.phase === 'error' ? 'error' : matched ? 'ok' : altered ? 'bad' : result ? 'unknown' : 'idle'
  const stamp = matched ? 'ok' : altered ? 'bad' : 'awaiting'
  const sealedAt = matched && result.blockTime ? `On the public ledger · ${formatWIB(result.blockTime * 1000)}` : null

  return (
    // Clip sideways only: the stamp lands from 1.15× and must never make the page scroll horizontally.
    <div className="-mx-2 overflow-x-clip px-2 pb-2">
      <div className={`relative ${altered ? 'st-shadow-bad' : 'st-shadow'}`}>
        <article aria-labelledby="pf-ticket-title" aria-describedby="pf-ticket-status">
          <div className="st-half-top relative rounded-t-lg bg-card px-5 pb-6 pt-5 sm:px-6">
            <div className="flex flex-col gap-4 pr-[84px] sm:pr-[104px]">
              <div className="flex min-w-0 items-center gap-3">
                <span
                  aria-hidden="true"
                  className={`flex size-11 shrink-0 items-center justify-center rounded-full text-[15px] font-semibold ${altered ? 'bg-bad-bg text-bad' : 'bg-paper-2 text-ink'}`}
                >
                  {initials(opening.controllerName)}
                </span>
                <span className="min-w-0">
                  <span className="line-clamp-2 break-words text-[15px] font-semibold leading-tight text-ink">{head.who}</span>
                  <span className="mt-0.5 block text-[13px] text-ink-2">Recorded an access · {formatWIB(opening.createdAt)}</span>
                </span>
              </div>
              <h2 id="pf-ticket-title" className="min-w-0">
                <span className="sr-only">{head.who} </span>
                <span
                  className={`block text-[clamp(40px,12vw,56px)] font-semibold leading-[0.92] tracking-[-0.045em] ${head.source === 'chain' ? 'text-bad' : 'text-ink'}`}
                >
                  {VERB[head.eventType] ?? 'Used'}
                </span>
                <span className="mt-1.5 block text-balance text-[19px] font-normal leading-tight tracking-[-0.01em] text-ink-2">
                  {TAIL[head.eventType] ?? 'a citizen’s data'}.
                </span>
              </h2>
            </div>
            <div className="absolute right-3 top-3 sm:right-4 sm:top-4">
              <ProofStamp
                key={stamp}
                kind={stamp}
                seconds={result && result.status !== 'NOT_FOUND' ? result.elapsedMs / 1000 : undefined}
                size={96}
              />
            </div>
            <p className="mt-3 text-[14px] leading-snug text-ink-2">
              {opening.purposeText} · {basisLabel(opening.legalBasisKey)}
            </p>
            <div id="pf-ticket-status" className="mt-4" aria-live="polite">
              <StatusPill kind={pill} />
            </div>
            {head.claimed ? (
              <p className="pf-rise mt-3 text-[14px] leading-snug text-bad">
                The ledger sealed this. The receipt now says: <span className="line-through decoration-[1.5px]">{head.claimed}</span>
              </p>
            ) : null}
            <span aria-hidden="true" className="st-perf absolute bottom-0 left-5 right-5 text-line-strong" />
          </div>

          <section aria-label="Receipt details" className="st-half-bottom rounded-b-lg bg-card py-1.5">
            <dl>
              {rows(opening, sealedAt).map((row, i) => {
                const m = row.field ? changed.get(row.field) : undefined
                if (m) {
                  return (
                    <div
                      key={row.key}
                      className="pf-rise flex flex-col gap-1 border-t border-line/70 bg-bad-bg/70 px-5 py-3 first:border-t-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4 sm:px-6"
                      style={{ '--i': i } as CSSProperties}
                    >
                      <dt className="flex items-center gap-1.5 text-[14px] font-medium text-bad">
                        <IconX size={13} strokeWidth={2.6} /> {row.label}
                      </dt>
                      <dd className="min-w-0 text-[14px] leading-snug sm:text-right">
                        <span className="block break-words text-bad line-through decoration-[1.5px]">
                          <span className="sr-only">Receipt says: </span>
                          {row.value}
                        </span>
                        <span className="mt-0.5 block break-words font-medium text-ok">Ledger sealed: {sealedWords(m.field, m.chain)}</span>
                      </dd>
                    </div>
                  )
                }
                return (
                  <div
                    key={row.key}
                    className="flex items-baseline justify-between gap-4 border-t border-line/70 px-5 py-3 first:border-t-0 sm:px-6"
                  >
                    <dt className="shrink-0 text-[14px] text-ink-2">{row.label}</dt>
                    <dd className={`min-w-0 break-words text-right text-[14px] text-ink ${row.mono ? 'font-mono text-[13px]' : ''}`}>{row.value}</dd>
                  </div>
                )
              })}
              {contract ? (
                <div className="pf-rise flex flex-col gap-1 border-t border-line/70 bg-bad-bg/70 px-5 py-3 sm:px-6">
                  <dt className="flex items-center gap-1.5 text-[14px] font-medium text-bad">
                    <IconX size={13} strokeWidth={2.6} /> Ledger entry
                  </dt>
                  <dd className="break-words text-[14px] leading-snug text-ink">
                    The receipt expects <span className="font-mono text-[13px]">{isHex(contract.db) ? shortHex(contract.db) : contract.db}</span>; the
                    ledger has <span className="font-mono text-[13px] text-bad">{sealedWords('contract', contract.chain)}</span>.
                  </dd>
                </div>
              ) : null}
            </dl>
          </section>
        </article>
      </div>
    </div>
  )
}
