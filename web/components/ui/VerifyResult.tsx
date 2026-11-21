'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { ReceiptOpening, VerifyResult as VerifyResultT } from '@/lib/shared/types'
import { EVENT_LABELS, EVENT_TYPES, type EventTypeName } from '@/lib/shared/types'
import { basisLabel, eventVerb, shortHex } from '@/lib/format'
import { Button } from './Button'
import { DotoValue } from './DotoValue'
import { IconCheck, IconQuestion, IconRefresh, IconShield, IconX } from './icons'
import { RegMarks } from './RegMarks'
import { VaultSeal } from './VaultSeal'

const FIELD_LABEL: Record<VerifyResultT['mismatches'][number]['field'], string> = {
  eventType: 'What they did',
  purpose: 'Why',
  legalBasis: 'Legal basis',
  evidence: 'Evidence',
  pseudonym: 'Your pseudonym',
  contract: 'Contract',
}

const FIELD_ORDER = ['eventType', 'purpose', 'legalBasis', 'evidence', 'pseudonym'] as const

function human(v: string) {
  return (EVENT_TYPES as readonly string[]).includes(v) ? EVENT_LABELS[v as EventTypeName].toUpperCase() : v
}

function dbValue(field: (typeof FIELD_ORDER)[number], o: ReceiptOpening): string {
  switch (field) {
    case 'eventType':
      return eventVerb(o.eventType)
    case 'purpose':
      return `"${o.purposeText}"`
    case 'legalBasis':
      return basisLabel(o.legalBasisKey)
    case 'evidence':
      return 'Evidence fingerprint'
    case 'pseudonym':
      return shortHex(o.subjectPseudonym)
  }
}

/** Timer: shared DotoValue, identical to the landing ("1.8 s"). */
function Secs({ ms, className = '' }: { ms: number; className?: string }) {
  return <DotoValue value={(ms / 1000).toFixed(1)} unit="s" className={`text-[44px] leading-[0.9] text-vault-ink ${className}`} />
}

// ---------------------------------------------------------------------------------------------

function SealSlab({
  tone,
  children,
}: {
  tone: 'idle' | 'ok' | 'bad' | 'unknown'
  children: ReactNode
}) {
  return (
    <div className="vault grain flex items-center gap-4 rounded-t-[22px] bg-vault p-4 text-vault-ink">
      <div className="relative z-[1] w-[88px] shrink-0 sm:w-[104px]">
        <VaultSeal tone={tone} grid={false} boost={1.45} />
      </div>
      <div className="relative z-[1] min-w-0 flex-1">{children}</div>
    </div>
  )
}

/** Live tenths-of-a-second clock while the phone asks the chain. `elapsedMs` freezes it (dev gallery). */
function useElapsed(startedAt: number, frozen?: number): number {
  const [now, setNow] = useState(0)
  useEffect(() => {
    if (frozen !== undefined || !startedAt) return
    const id = setInterval(() => setNow(Date.now()), 100)
    return () => clearInterval(id)
  }, [startedAt, frozen])
  if (frozen !== undefined) return frozen
  return now && startedAt ? Math.max(0, now - startedAt) : 0
}

export function VerifyRunning({ startedAt, elapsedMs }: { startedAt: number; elapsedMs?: number }) {
  const elapsed = useElapsed(startedAt, elapsedMs)
  return (
    <div className="overflow-hidden rounded-xl border border-vault-line" aria-busy="true">
      <SealSlab tone="idle">
        <p className="label text-[11px] text-ice">Checking on chain</p>
        <Secs ms={elapsed} className="mt-2" />
        <p className="label mt-2 text-[11px] text-vault-ink-2">Your phone is asking the chain…</p>
      </SealSlab>
      <ol className="flex flex-col gap-0 bg-vault-2 px-4 py-3 font-mono text-[12px] text-vault-ink-2">
        {['Fetch the sealed transaction', 'Read the sealed event', 'Compare 5 fields with the database'].map((s, i) => (
          <li key={s} className="flex items-center gap-2.5 py-1">
            <span
              className={`h-1.5 w-1.5 rounded-full ${elapsed > (i + 1) * 520 ? 'bg-ice' : 'bg-dot'}`}
              aria-hidden="true"
            />
            {s}
          </li>
        ))}
      </ol>
    </div>
  )
}

export function VerifyResult({
  result,
  opening,
  onRetry,
}: {
  result: VerifyResultT
  opening: ReceiptOpening
  onRetry?: () => void
}) {
  if (result.status === 'MATCH') {
    return (
      <section aria-labelledby="vr-title" className="anim-rise relative rounded-xl border-2 border-ok bg-card">
        <RegMarks className="bg-ok" size={8} />
        <SealSlab tone="ok">
          <p className="label text-[11px] text-ok-v">Verified in</p>
          <Secs ms={result.elapsedMs} className="mt-1.5" />
        </SealSlab>
        <div className="p-5">
          <div className="flex items-start gap-3.5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-ok text-white">
              <IconCheck size={28} strokeWidth={2.6} />
            </span>
            <div>
              <p className="label text-ok">
                <span className="font-bold">MATCH</span>
              </p>
              <h2 id="vr-title" className="display mt-1 text-[26px] leading-[1.1] text-ink">
                This record <span className="text-ok">matches the chain.</span>
              </h2>
            </div>
          </div>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-2">
            It is authentic and unchanged since the chain sealed it.
          </p>
          <p className="label mt-4 flex items-center gap-2 rounded-md bg-ok-bg px-3 py-2.5 text-[11px] text-ok">
            <IconShield size={15} strokeWidth={2} className="shrink-0" />
            Verified by your phone in {(result.elapsedMs / 1000).toFixed(1)} s · not by our server
          </p>
          <dl className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-lg bg-line font-mono text-[12px]">
            {[
              ['BLOCK', result.blockNumber ? Number(result.blockNumber).toLocaleString('en-US') : '—'],
              ['CONFIRMS', result.confirmations?.toLocaleString('en-US') ?? '—'],
              ['NODE', result.rpc.split('.')[0] ?? result.rpc],
            ].map(([k, v]) => (
              <div key={k} className="bg-card p-2.5">
                <dt className="label text-[11px] text-ink-2">{k}</dt>
                <dd className="tnum mt-1 truncate text-ink" title={v}>
                  {v}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    )
  }

  if (result.status === 'MISMATCH') {
    const changed = new Map(result.mismatches.map((m) => [m.field, m]))
    const contract = changed.get('contract')
    return (
      <section aria-labelledby="vr-title" className="anim-shake relative rounded-xl border-2 border-bad bg-bad text-white">
        <RegMarks className="bg-bad" size={8} />
        <SealSlab tone="bad">
          <p className="label text-[11px] text-bad-v">Checked in</p>
          <Secs ms={result.elapsedMs} className="mt-1.5" />
        </SealSlab>
        <div className="p-5">
          <div className="flex items-start gap-3.5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-white text-bad">
              <IconX size={28} strokeWidth={2.6} />
            </span>
            <div>
              <p className="label font-bold text-white">ALTERED</p>
              <h2 id="vr-title" className="display mt-1 text-[26px] leading-[1.1] text-white">
                The database <span className="text-white">no longer matches what the chain sealed.</span>
              </h2>
            </div>
          </div>
          <p className="mt-3 text-[15px] leading-relaxed text-white">
            Someone changed {result.mismatches.length === 1 ? 'one field' : `${result.mismatches.length} fields`} after
            the record was sealed. Keep this screen as evidence.
          </p>

          <div role="table" aria-label="Field comparison" className="mt-4 overflow-hidden rounded-lg bg-card text-ink">
            <div role="row" className="hidden grid-cols-[1fr_1.2fr_1.2fr] border-b border-line px-3 py-2 sm:grid">
              {['FIELD', 'DATABASE SAYS', 'CHAIN SEALED'].map((h) => (
                <span role="columnheader" key={h} className="label text-[11px] text-ink-2">
                  {h}
                </span>
              ))}
            </div>
            {FIELD_ORDER.map((f) => {
              const m = changed.get(f)
              return (
                <div
                  role="row"
                  key={f}
                  className={`grid grid-cols-1 gap-1 border-b border-line px-3 py-2.5 last:border-b-0 sm:grid-cols-[1fr_1.2fr_1.2fr] sm:gap-3 ${
                    m ? 'bg-bad-bg' : ''
                  }`}
                >
                  <span role="cell" className="flex items-center gap-1.5 text-[13px] font-medium">
                    {m ? (
                      <IconX size={14} strokeWidth={2.6} className="text-bad" />
                    ) : (
                      <IconCheck size={14} strokeWidth={2.6} className="text-ok" />
                    )}
                    {FIELD_LABEL[f]}
                    <span className="sr-only">{m ? '(changed)' : '(unchanged)'}</span>
                  </span>
                  <span role="cell" className="font-mono text-[12px] leading-snug break-words">
                    <span className="label mr-1 text-[11px] text-ink-2 sm:hidden">DB:</span>
                    <span className={m ? 'font-bold text-bad' : 'text-ink-2'}>{m ? human(m.db) : dbValue(f, opening)}</span>
                  </span>
                  <span role="cell" className="font-mono text-[12px] leading-snug break-words">
                    <span className="label mr-1 text-[11px] text-ink-2 sm:hidden">CHAIN:</span>
                    <span className={m ? 'font-bold text-ink' : 'text-ink-2'}>{m ? human(m.chain) : 'same'}</span>
                  </span>
                </div>
              )
            })}
            {contract ? (
              <div role="row" className="grid grid-cols-1 gap-1 bg-bad-bg px-3 py-2.5 sm:grid-cols-[1fr_2.4fr]">
                <span role="cell" className="flex items-center gap-1.5 text-[13px] font-medium">
                  <IconX size={14} strokeWidth={2.6} className="text-bad" /> Contract
                </span>
                <span role="cell" className="font-mono text-[12px] text-bad">
                  {contract.chain}
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    )
  }

  return (
    <section aria-labelledby="vr-title" className="anim-rise relative rounded-xl border-2 border-unknown/50 bg-unknown-bg">
      <RegMarks className="bg-unknown" size={8} />
      <SealSlab tone="unknown">
        <p className="label text-[11px] text-vault-ink-2">Searched for</p>
        <Secs ms={result.elapsedMs} className="mt-1.5" />
      </SealSlab>
      <div className="p-5">
        <div className="flex items-start gap-3.5">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-unknown text-white">
            <IconQuestion size={28} strokeWidth={2.4} />
          </span>
          <div>
            <p className="label font-bold text-unknown">NOT FOUND ON THIS NODE</p>
            <h2 id="vr-title" className="display mt-1 text-[26px] leading-[1.1] text-ink">
              No record yet. <span className="font-bold text-ink">This is not proof of tampering.</span>
            </h2>
          </div>
        </div>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-2">
          The node <span className="font-mono text-[13px] text-ink">{result.rpc}</span> has no record for this
          fingerprint. It may be slow, or the transaction may still be mining.
        </p>
        {onRetry ? (
          <Button variant="light" className="mt-4" full icon={<IconRefresh size={16} />} onClick={onRetry}>
            Try another node
          </Button>
        ) : null}
      </div>
    </section>
  )
}

export type VerifyPhase = 'idle' | 'running' | 'done' | 'error'

/** Presentational verify block: button → running timer → result. All state comes from props. */
export function VerifyStage({
  phase,
  opening,
  startedAt = 0,
  elapsedMs,
  result,
  error,
  onVerify,
  onRetry,
}: {
  phase: VerifyPhase
  opening: ReceiptOpening
  startedAt?: number
  /** Freezes the running timer (dev gallery). */
  elapsedMs?: number
  result?: VerifyResultT | null
  error?: string | null
  onVerify: () => void
  /** "Try another node" / "Verify again". Defaults to onVerify. */
  onRetry?: () => void
}) {
  const retry = onRetry ?? onVerify
  return (
    <div className="flex flex-col gap-3">
      {phase === 'idle' || phase === 'error' ? (
        <Button variant="dark" size="lg" arrow full onClick={onVerify} icon={<IconShield size={18} />}>
          Verify on chain
        </Button>
      ) : null}
      <div aria-live="polite" aria-atomic="true">
        {phase === 'running' ? <VerifyRunning startedAt={startedAt} elapsedMs={elapsedMs} /> : null}
        {phase === 'done' && result ? <VerifyResult result={result} opening={opening} onRetry={retry} /> : null}
        {phase === 'error' ? (
          <p role="alert" className="rounded-lg border border-line-strong bg-card p-3 text-[14px] text-ink-2">
            {error ?? 'Verification failed. Check your connection.'} <span className="text-ink">Nothing was decided.</span>
          </p>
        ) : null}
      </div>
      {phase === 'done' ? (
        <button
          type="button"
          onClick={retry}
          className="label flex min-h-11 items-center justify-center gap-2 text-ink-2 hover:text-blue"
        >
          <IconRefresh size={14} /> Verify again
        </button>
      ) : null}
    </div>
  )
}

/** Self-contained verify block (used by /proof). `run` does the check; the duration is measured here. */
export function VerifyPanel({
  opening,
  run,
  autoStart,
  onResult,
}: {
  opening: ReceiptOpening
  run: (attempt: number) => Promise<VerifyResultT>
  autoStart?: boolean
  onResult?: (r: VerifyResultT) => void
}) {
  const [phase, setPhase] = useState<VerifyPhase>('idle')
  const [startedAt, setStartedAt] = useState(0)
  const [result, setResult] = useState<VerifyResultT | null>(null)
  const [error, setError] = useState<string | null>(null)
  const attempt = useRef(0)
  const started = useRef(false)

  const onVerify = async () => {
    attempt.current += 1
    setPhase('running')
    setResult(null)
    const t0 = performance.now()
    setStartedAt(Date.now())
    try {
      const r = { ...(await run(attempt.current)), elapsedMs: Math.round(performance.now() - t0) }
      setResult(r)
      setPhase('done')
      onResult?.(r)
      if (r.status === 'MISMATCH' && typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.([40, 60, 40])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Verification failed. Check your connection.')
      setPhase('error')
    }
  }

  const startRef = useRef(onVerify)
  useEffect(() => {
    startRef.current = onVerify
  })
  useEffect(() => {
    if (autoStart && !started.current) {
      started.current = true
      void startRef.current()
    }
  }, [autoStart])

  return (
    <VerifyStage
      phase={phase}
      opening={opening}
      startedAt={startedAt}
      result={result}
      error={error}
      onVerify={() => void onVerify()}
    />
  )
}
