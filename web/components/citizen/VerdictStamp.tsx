'use client'

import { useId } from 'react'
import type { VerifyResult } from '@/lib/shared/types'
import '@/app/citizen/stub-ticket.css'

export type StampKind = 'checking' | 'ok' | 'bad'

const RING: Record<StampKind, string> = {
  ok: 'MATCHES THE CHAIN · CHECKED BY YOUR PHONE ·',
  bad: 'CHANGED AFTER SEALING · CHECKED BY YOUR PHONE ·',
  checking: 'CHECKING THE CHAIN · CHECKING THE CHAIN ·',
}
const LABEL: Record<StampKind, string> = {
  ok: 'Stamped: matches the chain, checked by your phone',
  bad: 'Stamped: changed after sealing, checked by your phone',
  checking: 'Checking the chain',
}

/**
 * The verdict as an official stamp pressed onto the receipt ticket (riset-ui/36 A). One stamp per verdict:
 * green MATCH, red ALTERED (lands, then one shake), a breathing dashed ring while the phone checks.
 * NOT FOUND and pending get no stamp. Reduced motion: the stamp is simply there.
 */
export function VerdictStamp({ kind, seconds, size = 112 }: { kind: StampKind; seconds?: number; size?: number }) {
  const id = useId().replace(/:/g, '')
  const r = 58
  const t = r - 10
  const tone = kind === 'ok' ? 'text-ok' : kind === 'bad' ? 'text-bad' : 'text-ink-3'
  const cls = kind === 'checking' ? 'st-stamp-checking' : kind === 'bad' ? 'st-stamp st-stamp-bad' : 'st-stamp'
  return (
    <div className={`pointer-events-none shrink-0 ${cls}`} style={{ width: size, height: size }} role="img" aria-label={LABEL[kind]}>
      <svg viewBox="0 0 132 132" className={`h-full w-full ${tone}`}>
        <defs>
          <path id={`ring-${id}`} d={`M66,66 m-${t},0 a${t},${t} 0 1,1 ${t * 2},0 a${t},${t} 0 1,1 -${t * 2},0`} />
        </defs>
        {kind === 'checking' ? (
          <circle className="st-ring-dash" cx="66" cy="66" r={r} fill="none" stroke="currentColor" strokeWidth="2.4" strokeDasharray="6 7" />
        ) : (
          <circle cx="66" cy="66" r={r} fill="none" stroke="currentColor" strokeWidth="2.6" opacity="0.92" />
        )}
        <circle cx="66" cy="66" r={r - 18} fill="none" stroke="currentColor" strokeWidth="1.2" opacity={kind === 'checking' ? 0.5 : 0.75} />
        <text fill="currentColor" fontSize={kind === 'bad' ? 8.4 : 9.4} fontWeight="700" letterSpacing={kind === 'bad' ? 0.9 : 1.1} fontFamily="var(--font-geist-mono)" opacity={kind === 'checking' ? 0.7 : 1}>
          <textPath href={`#ring-${id}`}>{RING[kind]}</textPath>
        </text>
        {kind === 'ok' ? (
          <path d="M51 64.5 61.5 75 81 54" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        ) : kind === 'bad' ? (
          <path d="M54 52 78 76M78 52 54 76" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
        ) : (
          <g fill="currentColor" opacity="0.6">
            <circle cx="56" cy="66" r="2.6" />
            <circle cx="66" cy="66" r="2.6" />
            <circle cx="76" cy="66" r="2.6" />
          </g>
        )}
        {seconds !== undefined && kind !== 'checking' ? (
          <text x="66" y="92" textAnchor="middle" fill="currentColor" fontSize="9.5" fontWeight="600" fontFamily="var(--font-geist-mono)">
            {seconds.toFixed(2)} S
          </text>
        ) : null}
      </svg>
    </div>
  )
}

/**
 * Three numbers under the ticket once the phone has a verdict (graft from direction B): seconds the check
 * took, confirmations, fields changed. Red only when a field changed.
 */
export function ChainReadout({ result }: { result: VerifyResult }) {
  const changed = result.status === 'MISMATCH' ? result.mismatches.length : 0
  const cells: Array<[string, string, string]> = [
    [(result.elapsedMs / 1000).toFixed(2), 'seconds', result.status === 'MATCH' ? 'text-ok' : 'text-ink'],
    [result.confirmations !== undefined ? result.confirmations.toLocaleString('en-US') : '—', 'confirmations', 'text-ink'],
    [String(changed), changed === 1 ? 'field changed' : 'fields changed', changed ? 'text-bad' : 'text-ink'],
  ]
  return (
    <section aria-label="Chain check" className="st-rise flex flex-col gap-2">
      <dl className="grid grid-cols-3 divide-x divide-line rounded-lg border border-line bg-card py-3.5">
        {cells.map(([v, k, c]) => (
          <div key={k} className="flex min-w-0 flex-col-reverse items-center px-2 text-center">
            <dt className="mt-2 text-[13px] text-ink-2">{k}</dt>
            <dd className={`doto text-[28px] ${c}`}>{v}</dd>
          </div>
        ))}
      </dl>
      <p className="px-1 text-center text-[13px] leading-snug text-ink-2">
        Checked by your phone, not by Saksi&apos;s server
        {result.blockNumber ? ` · block ${Number(result.blockNumber).toLocaleString('en-US')}` : ''}
      </p>
    </section>
  )
}
