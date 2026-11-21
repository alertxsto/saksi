'use client'

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { CountSecs, RiseHeading as Heading } from '@/components/citizen/motion'
import { VerdictSeal } from '@/components/citizen/VerdictSeal'
import type { ReceiptCheck } from '@/lib/receipt-state'
import type { ReceiptOpening, VerifyResult as VerifyResultT } from '@/lib/shared/types'
import { EVENT_LABELS, EVENT_TYPES, type EventTypeName } from '@/lib/shared/types'
import { basisLabel, eventVerb, rpcLabel, shortHex } from '@/lib/format'
import { Act } from '@/components/citizen/Act'
import { DotoValue } from './DotoValue'
import { IconAlert, IconArrow, IconCheck, IconClock, IconDownload, IconLock, IconRefresh, IconShield, IconSpark } from './icons'

type Field = VerifyResultT['mismatches'][number]['field']

const FIELD_LABEL: Record<Field, string> = {
  eventType: 'What they did',
  legalBasis: 'Legal basis',
  purpose: 'Why',
  evidence: 'Evidence',
  pseudonym: 'Pseudonym',
  contract: 'Contract',
}

/** Row order of the comparison table (riset-ui/24 §2b). Contract only shows when it changed. */
const FIELD_ORDER = ['eventType', 'legalBasis', 'purpose', 'evidence', 'pseudonym'] as const

function human(v: string) {
  return (EVENT_TYPES as readonly string[]).includes(v) ? EVENT_LABELS[v as EventTypeName] : v
}

function dbValue(field: (typeof FIELD_ORDER)[number], o: ReceiptOpening): string {
  switch (field) {
    case 'eventType':
      return eventVerb(o.eventType)
    case 'purpose':
      return o.purposeText
    case 'legalBasis':
      return basisLabel(o.legalBasisKey)
    case 'evidence':
      return 'Evidence fingerprint'
    case 'pseudonym':
      return shortHex(o.subjectPseudonym)
  }
}

const secs = (ms: number) => (ms / 1000).toFixed(1)

// ---------------------------------------------------------------------------------------------
// Vault panel: the dark slab every verdict lives on (hero language). Seal left, label + Doto right.
// ---------------------------------------------------------------------------------------------

type PanelTone = 'idle' | 'ok' | 'bad' | 'unknown'

const PANEL_BORDER: Record<PanelTone, string> = {
  idle: 'border-vault-line',
  ok: 'border-ok-v/35',
  bad: 'border-bad-v/60',
  unknown: 'border-vault-line',
}

function VaultPanel({
  tone,
  label,
  labelClass,
  time,
  scan,
  children,
  className = '',
}: {
  tone: PanelTone
  label: string
  labelClass: string
  time: ReactNode
  scan?: boolean
  children?: ReactNode
  className?: string
}) {
  return (
    <div className={`vault grain overflow-hidden rounded-xl border bg-vault text-vault-ink ${PANEL_BORDER[tone]} ${className}`}>
      <div className="relative z-[1] flex items-center gap-3 px-3 pt-3">
        <VerdictSeal tone={tone} scan={scan} className="w-[128px] shrink-0" />
        <div className="min-w-0 flex-1 pr-1">
          <p className={`text-[14px] font-medium ${labelClass}`}>{label}</p>
          <div className="cz-secs mt-2 text-[52px] leading-[0.85] text-vault-ink">{time}</div>
        </div>
      </div>
      {children ? <div className="relative z-[1] px-4 pb-4 pt-1">{children}</div> : <div className="h-3" />}
    </div>
  )
}

/** "Checked by your phone in 0.4 s · not by Saksi's server" — X is the measured round trip, never typed. Sits on the vault panel. */
function ByLine({ verb, ms, device, tone }: { verb: string; ms: number; device: string; tone: 'ok' | 'bad' | 'unknown' }) {
  const c = tone === 'ok' ? 'text-ok-v' : tone === 'bad' ? 'text-bad-v' : 'text-vault-ink-2'
  return (
    <p className={`flex items-start gap-2 border-t border-vault-line pt-3 text-[13px] leading-[1.5] ${c}`}>
      <IconShield size={14} strokeWidth={2} className="mt-px shrink-0" />
      <span>
        {verb} by {device} in {secs(ms)} s · not by Saksi&apos;s server
      </span>
    </p>
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

const STEPS = ['Fetch the sealed transaction', 'Read the sealed event', 'Compare 5 fields with the database']

/** 'panel' (default): the vault slab (/proof, regulator). 'ticket': quiet paper block under the citizen receipt ticket, whose stamp carries the verdict. */
export type VerifyVariant = 'panel' | 'ticket'

export function VerifyRunning({ startedAt, elapsedMs, variant = 'panel' }: { startedAt: number; elapsedMs?: number; variant?: VerifyVariant }) {
  const elapsed = useElapsed(startedAt, elapsedMs)
  if (variant === 'ticket') {
    return (
      <div aria-busy="true" className="rounded-lg border border-line bg-card px-4 pb-2 pt-3.5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[16px] font-medium text-ink">Your phone is asking the chain</p>
          <p className="tnum shrink-0 text-ink">
            <span className="doto text-[26px]">{secs(elapsed)}</span> <span className="text-[14px] text-ink-2">s</span>
          </p>
        </div>
        <ol className="mt-2 flex flex-col text-[14px]">
          {STEPS.map((s, i) => {
            const done = elapsed > (i + 1) * 520
            const active = !done && elapsed > i * 520
            return (
              <li key={s} className={`flex min-h-10 items-center gap-2.5 border-t border-line/70 transition-colors duration-300 ${done ? 'text-ink' : active ? 'text-blue' : 'text-ink-2'}`}>
                <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${done ? 'bg-ink' : active ? 'cz-blink bg-blue' : 'bg-line-strong'}`} />
                {s}
                {done ? <IconCheck size={14} strokeWidth={2.4} className="ml-auto text-ink" /> : null}
              </li>
            )
          })}
        </ol>
      </div>
    )
  }
  return (
    <div aria-busy="true">
      <VaultPanel
        tone="idle"
        scan
        label="Checking on chain"
        labelClass="text-ice"
        time={<DotoValue value={secs(elapsed)} unit="s" />}
      >
        <ol className="mt-2 flex flex-col border-t border-vault-line font-mono text-[12px]">
          {STEPS.map((s, i) => {
            const done = elapsed > (i + 1) * 520
            const active = !done && elapsed > i * 520
            return (
              <li
                key={s}
                className={`flex min-h-9 items-center gap-2.5 border-b border-vault-line/70 transition-colors duration-300 last:border-b-0 ${
                  done ? 'text-vault-ink' : active ? 'text-ice' : 'text-vault-ink-2/70'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`h-1.5 w-1.5 shrink-0 rounded-full transition-colors duration-300 ${done ? 'bg-ice' : active ? 'cz-blink bg-ice' : 'bg-dot'}`}
                />
                {s}
                {done ? <IconCheck size={13} strokeWidth={2.4} className="ml-auto text-ice" /> : null}
              </li>
            )
          })}
        </ol>
        <p className="mt-3 text-[13px] text-vault-ink-2">Your phone is asking the chain itself</p>
      </VaultPanel>
    </div>
  )
}

/**
 * Database vs chain, stacked per changed field (riset-ui/26 C4: no side-by-side columns at 390 px):
 * field → "Database says" struck through on a red tint → "Chain sealed" on a green tint. Unchanged
 * fields collapse into one grey line so the difference is the only thing that reads.
 */
function Compare({ result, opening }: { result: VerifyResultT; opening: ReceiptOpening }) {
  const changed = new Map(result.mismatches.map((m) => [m.field, m]))
  const order: Field[] = [...FIELD_ORDER, 'contract']
  const diff = order.filter((f) => changed.has(f))
  const same = FIELD_ORDER.filter((f) => !changed.has(f))
  return (
    <div className="flex flex-col">
      <p className="border-b border-line-strong pb-2 text-[13px] text-ink-2">
        Comparing the database now with what was sealed
        {result.blockNumber ? ` at block ${Number(result.blockNumber).toLocaleString('en-US')}` : ''}
      </p>
      <dl aria-label="What changed: database versus chain">
        {diff.map((f, i) => {
          const m = changed.get(f)!
          return (
            <div key={f} className="cz-cmp border-b border-line py-3.5" style={{ '--i': i } as CSSProperties}>
              <dt className="flex items-center gap-2 text-[14px] font-medium text-ink">
                {FIELD_LABEL[f]}
                <span className="rounded-[6px] bg-bad px-1.5 py-px text-[12px] font-medium leading-[1.5] text-white">Changed</span>
              </dt>
              <dd className="mt-2 flex flex-col gap-1.5 font-mono text-[13px] leading-snug break-words">
                <span className="cz-struck relative rounded-sm bg-bad-bg px-2.5 py-2">
                  <span className="block font-sans text-[12px] font-medium text-bad">Database says</span>
                  <span className="mt-0.5 block text-bad line-through decoration-bad/80 decoration-[1.5px]">
                    <span className="sr-only">Database says: </span>
                    {human(m.db)}
                  </span>
                </span>
                <span className="rounded-sm bg-ok-bg px-2.5 py-2">
                  <span className="flex items-center gap-1 font-sans text-[12px] font-medium text-ok">
                    <IconLock size={11} strokeWidth={2.4} /> Chain sealed
                  </span>
                  <span className="mt-0.5 block font-semibold text-ok">
                    <span className="sr-only">Chain sealed: </span>
                    {human(m.chain)}
                  </span>
                </span>
              </dd>
            </div>
          )
        })}
      </dl>
      {same.length ? (
        <details className="group border-b border-line">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-[13px] text-ink-2 [&::-webkit-details-marker]:hidden">
            <IconCheck size={14} strokeWidth={2.4} className="shrink-0 text-ink-3" />
            <span className="min-w-0 flex-1">
              {same.length} field{same.length === 1 ? '' : 's'} match: {same.map((f) => FIELD_LABEL[f]).join(', ')}
            </span>
            <IconArrow size={13} className="shrink-0 rotate-90 text-ink-3 transition-transform group-open:-rotate-90" aria-hidden="true" />
          </summary>
          <dl className="pb-3">
            {same.map((f) => (
              <div key={f} className="flex items-baseline justify-between gap-3 py-1 font-mono text-[12px]">
                <dt className="font-sans text-[13px] text-ink-2">{FIELD_LABEL[f]}</dt>
                <dd className="min-w-0 truncate text-right text-ink-2">{dbValue(f, opening)}</dd>
              </div>
            ))}
          </dl>
        </details>
      ) : null}
    </div>
  )
}

export function VerifyResult({
  result,
  opening,
  onRetry,
  onKeepEvidence,
  onAskAi,
  device = 'your phone',
  variant = 'panel',
}: {
  result: VerifyResultT
  opening: ReceiptOpening
  onRetry?: () => void
  /** ALTERED: "Keep as evidence" (download / share the proof). Hidden when absent. */
  onKeepEvidence?: () => void
  /** ALTERED: "Ask AI what this means" (AI explains, never decides). Hidden when absent. */
  onAskAi?: () => void
  /** Who checked: "your phone" (citizen) or "your browser" (/proof). */
  device?: string
  variant?: VerifyVariant
}) {
  if (variant === 'ticket') return <TicketResult result={result} opening={opening} onRetry={onRetry} onKeepEvidence={onKeepEvidence} onAskAi={onAskAi} />
  if (result.status === 'MATCH') {
    return (
      <section aria-labelledby="vr-title" className="anim-rise flex flex-col gap-4">
        <VaultPanel tone="ok" label="Match" labelClass="text-ok-v" time={<CountSecs ms={result.elapsedMs} />}>
          <ByLine verb="Verified" ms={result.elapsedMs} device={device} tone="ok" />
        </VaultPanel>
        <div>
          <Heading as="h2" id="vr-title" lead="This record" tail="matches the chain." className="text-[34px] leading-[1.04] text-ink" tailClass="text-ok" />
          <p className="mt-2 text-[16px] leading-[1.6] tracking-[0.01em] text-ink-2">It is authentic and unchanged since the chain sealed it.</p>
        </div>
        <dl className="grid grid-cols-3 border-y border-line font-mono text-[12px]">
          {[
            ['Block', result.blockNumber ? Number(result.blockNumber).toLocaleString('en-US') : '—'],
            ['Confirmations', result.confirmations?.toLocaleString('en-US') ?? '—'],
            ['Node', rpcLabel(result.rpc), result.rpc],
          ].map(([k, v, full], i) => (
            <div key={k} className={`min-w-0 py-2.5 ${i ? 'border-l border-line pl-3' : ''}`}>
              <dt className="font-sans text-[12px] text-ink-2">{k}</dt>
              <dd className="tnum mt-1 truncate text-ink" title={full ?? v}>
                {v}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    )
  }

  if (result.status === 'MISMATCH') {
    const n = result.mismatches.length
    return (
      <section aria-labelledby="vr-title" className="cz-verdict-bad flex flex-col gap-4">
        <VaultPanel tone="bad" label="Altered" labelClass="text-bad-v" time={<CountSecs ms={result.elapsedMs} />}>
          <ByLine verb="Checked" ms={result.elapsedMs} device={device} tone="bad" />
        </VaultPanel>
        <div>
          <Heading as="h2" id="vr-title" lead="This record was" tail="changed after sealing." className="text-[34px] leading-[1.04] text-ink" tailClass="text-bad" />
          <p className="mt-2 text-[16px] leading-[1.6] tracking-[0.01em] text-ink-2">
            The company&apos;s database no longer matches what the chain sealed.{' '}
            <span className="text-ink">{n === 1 ? 'One field was' : `${n} fields were`} edited.</span>
          </p>
        </div>

        <Compare result={result} opening={opening} />

        {onKeepEvidence || onAskAi ? (
          <div className="flex flex-col gap-2.5 pt-1">
            {onKeepEvidence ? <Act full icon={<IconDownload size={17} />} onClick={onKeepEvidence}>Keep as evidence</Act> : null}
            {onAskAi ? (
              <Act variant="light" full icon={<IconSpark size={16} className="text-ai" />} onClick={onAskAi}>
                Ask AI what this means
              </Act>
            ) : null}
            <p className="text-center text-[13px] text-ink-2">AI explains, it never decides. The verdict is above.</p>
          </div>
        ) : null}
      </section>
    )
  }

  return (
    <section aria-labelledby="vr-title" className="anim-rise flex flex-col gap-4">
      <VaultPanel tone="unknown" label="Not found on this node" labelClass="text-vault-ink-2" time={<CountSecs ms={result.elapsedMs} />}>
        <ByLine verb="Searched" ms={result.elapsedMs} device={device} tone="unknown" />
      </VaultPanel>
      <div>
        <Heading as="h2" id="vr-title" lead="No record yet." tail="This is not proof of tampering." className="text-[34px] leading-[1.04] text-ink" tailClass="text-ink-2" />
        <p className="mt-2 text-[16px] leading-[1.6] tracking-[0.01em] text-ink-2">
          The node <span className="font-mono text-[13px] text-ink">{result.rpc}</span> has no record for this fingerprint.
          It may be slow, or the transaction may still be mining.
        </p>
      </div>
      {onRetry ? (
        <Act variant="light" full icon={<IconRefresh size={16} />} onClick={onRetry}>
          Try another node
        </Act>
      ) : null}
    </section>
  )
}

/**
 * Citizen receipt (variant 'ticket'): the stamp and the readout above already say MATCH, so MATCH adds nothing
 * visible here. ALTERED keeps the per-field comparison and the evidence actions; NOT FOUND is a grey note, never red.
 */
function TicketResult({
  result,
  opening,
  onRetry,
  onKeepEvidence,
  onAskAi,
}: {
  result: VerifyResultT
  opening: ReceiptOpening
  onRetry?: () => void
  onKeepEvidence?: () => void
  onAskAi?: () => void
}) {
  if (result.status === 'MATCH') return <p className="sr-only">This record matches the chain. Checked by your phone in {secs(result.elapsedMs)} seconds.</p>
  if (result.status === 'MISMATCH') {
    const n = result.mismatches.length
    return (
      <section aria-labelledby="vr-title" className="cz-verdict-bad flex flex-col gap-4">
        <div>
          <h2 id="vr-title" className="text-balance text-[24px] font-semibold leading-[1.15] tracking-[-0.02em] text-ink">
            This record was <span className="text-bad">changed after sealing.</span>
          </h2>
          <p className="mt-1.5 text-[15px] leading-[1.55] text-ink-2">
            The company&apos;s database no longer matches what the chain sealed.{' '}
            <span className="text-ink">{n === 1 ? 'One field was' : `${n} fields were`} edited.</span>
          </p>
        </div>
        <Compare result={result} opening={opening} />
        {onKeepEvidence || onAskAi ? (
          <div className="flex flex-col gap-2.5 pt-1">
            {onKeepEvidence ? <Act full icon={<IconDownload size={17} />} onClick={onKeepEvidence}>Keep as evidence</Act> : null}
            {onAskAi ? (
              <Act variant="light" full icon={<IconSpark size={16} className="text-ai" />} onClick={onAskAi}>
                Ask AI what this means
              </Act>
            ) : null}
            <p className="text-center text-[13px] text-ink-2">AI explains, it never decides. The verdict is the stamp.</p>
          </div>
        ) : null}
      </section>
    )
  }
  return (
    <section aria-labelledby="vr-title" className="anim-rise flex flex-col gap-3 rounded-lg border border-line bg-unknown-bg/70 p-4">
      <div className="flex items-start gap-3">
        <IconClock size={18} className="mt-0.5 shrink-0 text-unknown" />
        <div className="min-w-0">
          <h2 id="vr-title" className="text-[17px] font-semibold leading-snug text-ink">
            Not found on this node yet
          </h2>
          <p className="mt-1 text-[15px] leading-[1.55] text-ink-2">
            <span className="text-ink">This is not proof of tampering.</span> The node{' '}
            <span className="break-all font-mono text-[13px] text-ink">{rpcLabel(result.rpc)}</span> may be slow, or the transaction may still be mining.
          </p>
        </div>
      </div>
      {onRetry ? (
        <Act variant="light" full icon={<IconRefresh size={16} />} onClick={onRetry}>
          Try another node
        </Act>
      ) : null}
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
  onKeepEvidence,
  onAskAi,
  device,
  variant = 'panel',
  verifyLabel = 'Verify on chain',
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
  onKeepEvidence?: () => void
  onAskAi?: () => void
  device?: string
  variant?: VerifyVariant
  /** Primary button text ("Check on chain again" once a background check already ran). */
  verifyLabel?: string
}) {
  const retry = onRetry ?? onVerify
  return (
    <div className="flex flex-col gap-3">
      {phase === 'idle' || phase === 'error' ? (
        <Act full icon={<IconShield size={17} />} onClick={onVerify}>
          {verifyLabel}
        </Act>
      ) : null}
      <div aria-live="polite" aria-atomic="true">
        {phase === 'running' ? <VerifyRunning startedAt={startedAt} elapsedMs={elapsedMs} variant={variant} /> : null}
        {phase === 'done' && result ? (
          <VerifyResult result={result} opening={opening} onRetry={retry} onKeepEvidence={onKeepEvidence} onAskAi={onAskAi} device={device} variant={variant} />
        ) : null}
        {phase === 'error' ? (
          <p role="alert" className={`flex items-start gap-2.5 text-[14px] leading-relaxed text-ink-2 ${variant === 'ticket' ? 'rounded-lg border border-line bg-card p-4' : 'border-y border-line py-3'}`}>
            <IconAlert size={16} className="mt-0.5 shrink-0 text-ink-2" />
            <span>
              {error ?? 'Verification failed. Check your connection.'} <span className="text-ink">Nothing was decided.</span>
            </span>
          </p>
        ) : null}
      </div>
      {phase === 'done' ? (
        <button
          type="button"
          onClick={retry}
          className="flex min-h-11 items-center justify-center gap-2 text-[14px] font-medium text-ink-2 hover:text-blue"
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
  onCheck,
}: {
  opening: ReceiptOpening
  run: (attempt: number) => Promise<VerifyResultT>
  autoStart?: boolean
  onResult?: (r: VerifyResultT) => void
  /** Every phase change (running / done / error), so the page header can show the same verdict. */
  onCheck?: (check: ReceiptCheck) => void
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
    onCheck?.({ phase: 'running' })
    const t0 = performance.now()
    setStartedAt(Date.now())
    try {
      const r = { ...(await run(attempt.current)), elapsedMs: Math.round(performance.now() - t0) }
      setResult(r)
      setPhase('done')
      onResult?.(r)
      onCheck?.({ phase: 'done', result: r, at: Date.now() })
      if (r.status === 'MISMATCH' && typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.([40, 60, 40])
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Verification failed. Check your connection.'
      setError(message)
      setPhase('error')
      onCheck?.({ phase: 'error', error: message, at: Date.now() })
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
      device="your browser"
      onVerify={() => void onVerify()}
    />
  )
}
