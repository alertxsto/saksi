'use client'

import { useId } from 'react'
import './proof.css'

export type ProofStampKind = 'ok' | 'bad' | 'awaiting'

const RING: Record<Exclude<ProofStampKind, 'awaiting'>, string> = {
  ok: 'MATCHES THE SEALED RECORD · CHECKED IN YOUR BROWSER ·',
  bad: 'CHANGED AFTER SEALING · CHECKED IN YOUR BROWSER ·',
}
const LABEL: Record<ProofStampKind, string> = {
  ok: 'Stamped: matches the sealed record, checked in your browser',
  bad: 'Stamped: changed after sealing, checked in your browser',
  awaiting: 'Not stamped yet',
}

/**
 * The citizen's verdict stamp (components/citizen/VerdictStamp) in the public verifier's words: it is the
 * visitor's browser that checked, not "your phone". Same geometry and ink. It lands once (riset-ui/37 §5:
 * 1.15 → 1, −14° → −12°; ALTERED adds one 2px shake). 'awaiting' is the empty dashed ring where the stamp
 * will land: static, never breathing.
 */
export function ProofStamp({ kind, seconds, size = 112, land = true }: { kind: ProofStampKind; seconds?: number; size?: number; land?: boolean }) {
  const id = useId().replace(/:/g, '')
  const r = 58
  const t = r - 10
  const ring = 2 * Math.PI * t
  const tone = kind === 'ok' ? 'text-ok' : kind === 'bad' ? 'text-bad' : 'text-line-strong'
  return (
    <div
      className="pf-stamp pointer-events-none shrink-0"
      data-land={kind !== 'awaiting' && land ? '' : undefined}
      data-tone={kind}
      style={{ width: size, height: size }}
      role="img"
      aria-label={LABEL[kind]}
    >
      <svg viewBox="0 0 132 132" className={`h-full w-full ${tone}`}>
        <defs>
          <path id={`pfring-${id}`} d={`M66,66 m-${t},0 a${t},${t} 0 1,1 ${t * 2},0 a${t},${t} 0 1,1 -${t * 2},0`} />
        </defs>
        {kind === 'awaiting' ? (
          <>
            <circle cx="66" cy="66" r={r} fill="none" stroke="currentColor" strokeWidth="1.6" strokeDasharray="5 6" />
            <circle cx="66" cy="66" r={r - 18} fill="none" stroke="currentColor" strokeWidth="1" opacity="0.6" />
          </>
        ) : (
          <>
            <circle cx="66" cy="66" r={r} fill="none" stroke="currentColor" strokeWidth="2.6" opacity="0.92" />
            <circle cx="66" cy="66" r={r - 18} fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.75" />
            <text fill="currentColor" fontSize="8.4" fontWeight="700" fontFamily="var(--font-geist-mono)" textLength={ring * 0.985} lengthAdjust="spacing">
              <textPath href={`#pfring-${id}`}>{RING[kind]}</textPath>
            </text>
            {kind === 'ok' ? (
              <path d="M51 64.5 61.5 75 81 54" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
            ) : (
              <path d="M54 52 78 76M78 52 54 76" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
            )}
            {seconds !== undefined ? (
              <text x="66" y="92" textAnchor="middle" fill="currentColor" fontSize="9.5" fontWeight="600" fontFamily="var(--font-geist-mono)">
                {seconds.toFixed(2)} S
              </text>
            ) : null}
          </>
        )}
      </svg>
    </div>
  )
}
