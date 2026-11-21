'use client'

import { useId } from 'react'
import type { VerifyResult } from '@/lib/shared/types'
import '@/app/citizen/stub-ticket.css'

export type StampKind = 'checking' | 'ok' | 'bad'

// Witness language (riset-ui/37 §2): the stamp is Saksi's notarial mark, not a chain readout.
const RING: Record<StampKind, string> = {
  ok: 'WITNESSED BY SAKSI · MATCHES THE SEAL ·',
  bad: 'CHANGED AFTER SEALING · SAKSI WITNESS ·',
  checking: 'YOUR PHONE IS CHECKING · CHECKING ·',
}
const LABEL: Record<StampKind, string> = {
  ok: 'Stamped: witnessed by Saksi, matches the sealed record',
  bad: 'Stamped: changed after sealing, caught by your phone',
  checking: 'Your phone is checking the sealed record',
}

/**
 * The verdict as an official stamp pressed onto the receipt ticket (riset-ui/36 A). One stamp per verdict:
 * green MATCH, red ALTERED (lands, then one shake), a breathing dashed ring while the phone checks.
 * NOT FOUND and pending get no stamp. Reduced motion: the stamp is simply there.
 */
export function VerdictStamp({
  kind,
  seconds,
  date,
  size = 112,
}: {
  kind: StampKind
  /** Kept for callers that still pass it; shown only when no `date` is given. */
  seconds?: number
  /** Date line in the centre, like a notary's dated stamp ("22 NOV 26"). Preferred over seconds. */
  date?: string
  size?: number
}) {
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
        <text fill="currentColor" fontSize={9} fontWeight="700" letterSpacing={1} fontFamily="var(--font-geist-mono)" opacity={kind === 'checking' ? 0.7 : 1}>
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
        {(date || seconds !== undefined) && kind !== 'checking' ? (
          <text x="66" y="92" textAnchor="middle" fill="currentColor" fontSize="9" fontWeight="700" letterSpacing="0.6" fontFamily="var(--font-geist-mono)">
            {date ? date.toUpperCase() : `${(seconds ?? 0).toFixed(2)} S`}
          </text>
        ) : null}
      </svg>
    </div>
  )
}

/**
 * One calm line under the ticket once the phone has a verdict (riset-ui/37 §2 replaces the Doto readout):
 * "Your phone compared all 6 fields with the sealed record · just now". Confirmations, block and timing
 * live in the ticket's collapsed Technical proof. Red only when a field changed.
 */
export function ChainReadout({ result, freshness = 'just now' }: { result: VerifyResult; freshness?: string }) {
  const changed = result.status === 'MISMATCH' ? result.mismatches.length : 0
  return (
    <section aria-label="Your phone's check" className="st-rise flex items-start gap-3 rounded-[16px] border border-line bg-card px-4 py-3.5">
      <span
        aria-hidden="true"
        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${changed ? 'bg-bad-bg text-bad' : 'bg-ok-bg text-ok'}`}
      >
        {changed ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
        )}
      </span>
      <p className="min-w-0 text-[15px] leading-[1.45] text-ink">
        Your phone compared all {FIELDS} fields with the sealed record
        {changed ? (
          <span className="text-bad">
            {' '}· {changed} {changed === 1 ? 'was' : 'were'} changed
          </span>
        ) : null}
        <span className="text-ink-3"> · {freshness}</span>
        <span className="mt-0.5 block text-[13px] text-ink-3">Checked on this device, not by Saksi&apos;s server.</span>
      </p>
    </section>
  )
}

/** The fields the phone compares with the seal: event type, legal basis, purpose, evidence, pseudonym, contract. */
const FIELDS = 6
