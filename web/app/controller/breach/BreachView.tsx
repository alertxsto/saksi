'use client'

import { useId, type ReactNode } from 'react'
import { AiChip } from '@/components/ui/AiPanel'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Chip, TwoTone } from '@/components/ui/Chip'
import { Countdown72 } from '@/components/ui/Countdown72'
import { IconAlert, IconCheck, IconRefresh, IconShield, IconSpark } from '@/components/ui/icons'
import { RegMarks } from '@/components/ui/RegMarks'
import { Skeleton } from '@/components/ui/Skeleton'
import { DEFAULT_TX_COPY, TxFlow, type TxStepCopy, type TxView } from '@/components/ui/TxStepper'
import { formatWIB } from '@/lib/format'
import { useNow } from '@/lib/hooks'
import type { AiMeta, Pasal46Fields } from '@/lib/shared/types'

const H = 3600

export const PASAL46_FIELDS: { k: keyof Pasal46Fields; label: string; letter: string }[] = [
  { k: 'dataAffected', letter: 'a', label: 'Personal data affected' },
  { k: 'whenAndHow', letter: 'b', label: 'When and how it happened' },
  { k: 'actionsTaken', letter: 'c', label: 'What you did to handle it' },
  { k: 'contact', letter: 'd', label: 'Who citizens can contact' },
]

export type DraftState = { status: 'idle' | 'loading' | 'error' | 'done'; meta?: AiMeta; error?: string }
export type CheckState = { status: 'idle' | 'checking' | 'on_time' | 'late' | 'error'; deadlineSec?: number; error?: string }
export type Edited = Partial<Record<keyof Pasal46Fields, boolean>>

export function toLocalInput(sec: number) {
  const d = new Date(sec * 1000)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

export function fieldsComplete(f: Pasal46Fields | null): f is Pasal46Fields {
  return Boolean(f && PASAL46_FIELDS.every(({ k }) => f[k].trim().length > 0))
}

function breachCopy(mode: 'on_time' | 'late'): TxStepCopy {
  return {
    preparing: { title: 'Prepare notice', detail: 'Report fingerprint + affected-count fingerprint' },
    signing: { title: 'Sign in MetaMask', detail: mode === 'late' ? 'anchorLate() · sealed as late' : 'anchor() · sealed on time' },
    broadcast: DEFAULT_TX_COPY.broadcast,
    confirmed: { title: 'Confirmed', detail: 'The regulator sees this notice now' },
  }
}

/**
 * /controller/breach, fully controlled. Handlers: onDraft, onCheckWithContract, onAnchor,
 * onRecordLate, onRetry, onReconfirm, onReset. `gate` wraps the seal panel (WalletGate).
 */
export function BreachView({
  narrative,
  onNarrativeChange,
  draft,
  onDraft,
  fields,
  edited,
  onFieldChange,
  detectedAtSec,
  onDetectedAtChange,
  affected,
  onAffectedChange,
  check,
  onCheckWithContract,
  mode,
  tx,
  onAnchor,
  onRecordLate,
  onRetry,
  onReconfirm,
  onReset,
  gate = (c) => c,
}: {
  narrative: string
  onNarrativeChange: (v: string) => void
  draft: DraftState
  onDraft: () => void
  fields: Pasal46Fields | null
  edited: Edited
  onFieldChange: (k: keyof Pasal46Fields, v: string) => void
  /** Unix seconds; 0 until the page has hydrated. */
  detectedAtSec: number
  onDetectedAtChange: (sec: number) => void
  affected: string
  onAffectedChange: (v: string) => void
  check: CheckState
  onCheckWithContract: () => void
  /** Which seal path the tx belongs to (null before a seal starts). */
  mode: 'on_time' | 'late' | null
  tx: TxView
  onAnchor: () => void
  onRecordLate: () => void
  onRetry: () => void
  onReconfirm: () => void
  onReset: () => void
  gate?: (content: ReactNode) => ReactNode
}) {
  const now = useNow()
  const nowSec = now ? now / 1000 : 0
  const ids = { narr: useId(), when: useId(), count: useId() }
  const drafting = draft.status === 'loading'
  const ready = fieldsComplete(fields) && affected.length > 0 && detectedAtSec > 0
  const lateBy = check.deadlineSec && nowSec ? Math.max(1, Math.ceil((nowSec - check.deadlineSec) / H)) : 0
  const usedH = detectedAtSec && nowSec ? Math.max(0, (nowSec - detectedAtSec) / H) : 0
  const sealed = tx.phase === 'confirmed'
  const started = tx.phase !== 'idle'

  const sealPanel = sealed ? (
    <div className="flex flex-col gap-4">
      <Badge kind={mode === 'late' ? 'LATE' : 'ON_TIME'} suffix={mode === 'late' ? `BY ${lateBy} H` : `${usedH.toFixed(1)} H OF 72 H`} />
      <p className="text-[18px] font-medium tracking-[-0.02em] text-ink">
        {mode === 'late' ? 'Sealed as late. That fact is now permanent.' : 'Sealed on time. The chain clock agrees.'}
      </p>
      <TxFlow tx={tx} copy={breachCopy(mode ?? 'on_time')} />
      <p className="text-[14px] text-ink-2">The regulator sees this notice immediately on their dashboard.</p>
      <Button variant="light" size="sm" onClick={onReset}>
        Start a new notice
      </Button>
    </div>
  ) : check.status === 'on_time' ? (
    <div className="flex flex-col gap-4">
      <p className="flex items-center gap-2 text-[15px] font-medium text-ok">
        <IconCheck size={18} strokeWidth={2.6} /> The contract accepts an on-time notice.
      </p>
      {check.deadlineSec ? (
        <p className="font-mono text-[13px] text-ink-2">Deadline {formatWIB(check.deadlineSec * 1000)}</p>
      ) : null}
      {started ? (
        <TxFlow tx={tx} copy={breachCopy('on_time')} onRetry={onRetry} onReconfirm={onReconfirm} />
      ) : (
        <Button variant="dark" size="lg" arrow full onClick={onAnchor} icon={<IconShield size={17} />}>
          Seal notice on chain
        </Button>
      )}
    </div>
  ) : check.status === 'late' ? (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-pending/40 bg-pending-bg p-4">
        <p className="label flex items-center gap-1.5 text-pending">
          <IconAlert size={14} strokeWidth={2.2} /> ClaimedWindowExpired
        </p>
        <p className="mt-2 text-[17px] font-medium tracking-[-0.02em] text-ink">Record as LATE · by {lateBy} H</p>
        <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">
          The 72-hour window from your detection time has passed, so the contract refuses an on-time notice. You must still
          notify. It will be sealed as late, permanently. No signature was requested yet.
        </p>
      </div>
      {started ? (
        <TxFlow tx={tx} copy={breachCopy('late')} onRetry={onRetry} onReconfirm={onReconfirm} />
      ) : (
        <Button variant="danger" size="lg" full onClick={onRecordLate} icon={<IconAlert size={17} />}>
          Record as LATE on chain
        </Button>
      )}
    </div>
  ) : (
    <div className="flex flex-col gap-3">
      <p className="text-[14px] leading-relaxed text-ink-2">
        Before you sign, Saksi asks the contract whether the notice is on time. Nothing is sent.
      </p>
      {check.status === 'error' ? (
        <p className="flex items-start gap-2 text-[14px] text-pending" role="alert">
          <IconAlert size={15} className="mt-0.5 shrink-0" /> {check.error ?? 'Could not reach the contract.'}
        </p>
      ) : null}
      <Button
        variant="dark"
        size="lg"
        arrow
        full
        loading={check.status === 'checking'}
        onClick={onCheckWithContract}
        disabled={!ready || check.status === 'checking'}
        icon={check.status === 'error' ? <IconRefresh size={16} /> : undefined}
      >
        {check.status === 'checking' ? 'Asking the contract…' : check.status === 'error' ? 'Try the check again' : 'Check with contract'}
      </Button>
      {!ready ? <p className="label text-center text-[11px] text-ink-2">Fill (a)–(d) and people affected first</p> : null}
    </div>
  )

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <TwoTone head="Notify within 72 hours." tail="The contract keeps the clock." className="text-[34px] md:text-[48px]" />
        <div className="flex flex-wrap gap-2">
          <Chip>UU PDP Art. 46</Chip>
          <Chip>Notice text stays off chain</Chip>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-6 lg:col-span-7">
          <section className="rounded-lg border border-line bg-card p-5 md:p-6">
            <label htmlFor={ids.narr} className="label text-ink">
              Your words
            </label>
            <p className="mt-1 text-[14px] text-ink-2">Describe what happened, plainly. AI turns it into the four required parts.</p>
            <textarea
              id={ids.narr}
              value={narrative}
              onChange={(e) => onNarrativeChange(e.target.value)}
              rows={4}
              placeholder="e.g. Yesterday our engineer found a customer export file in a public storage bucket…"
              className="mt-3 w-full resize-y rounded-md border border-line-strong bg-paper-2 p-3 text-[15px] leading-relaxed text-ink outline-none placeholder:text-ink-3 focus:border-blue"
            />
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Button
                variant="light"
                icon={<IconSpark size={16} className="text-ai" />}
                loading={drafting}
                onClick={onDraft}
                disabled={narrative.trim().length < 10 || drafting}
              >
                {drafting ? 'Drafting…' : fields ? 'Redraft with AI' : 'Draft with AI'}
              </Button>
              {draft.meta ? <AiChip meta={draft.meta} /> : null}
            </div>
            {draft.status === 'error' ? (
              <p className="mt-3 flex items-start gap-2 text-[14px] text-pending" role="alert">
                <IconAlert size={15} className="mt-0.5 shrink-0" />
                <span>
                  {draft.error ?? 'The AI could not draft this.'} You can try again or write the four parts yourself.
                </span>
              </p>
            ) : null}
          </section>

          <section className="flex flex-col gap-4" aria-label="Notice fields (a) to (d)" aria-busy={drafting}>
            {PASAL46_FIELDS.map((f) => {
              const id = `f-${f.k}`
              const isDraft = draft.status === 'done' && fields && !edited[f.k]
              return (
                <div key={f.k} className={`rounded-lg border bg-card p-4 ${isDraft ? 'border-ai/50' : 'border-line'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <label htmlFor={id} className="label text-ink">
                      <span className="text-blue">({f.letter})</span> {f.label}
                    </label>
                    {drafting ? null : isDraft ? (
                      <span className="label inline-flex h-6 shrink-0 items-center whitespace-nowrap rounded-pill border border-ai/40 bg-ai-bg px-2 text-[11px] text-ai">
                        AI draft · edit me
                      </span>
                    ) : edited[f.k] ? (
                      <span className="label inline-flex h-6 shrink-0 items-center gap-1 whitespace-nowrap text-[11px] text-ok">
                        <IconCheck size={12} strokeWidth={2.6} /> Edited by you
                      </span>
                    ) : null}
                  </div>
                  {drafting ? (
                    <div className="mt-3 flex flex-col gap-2" aria-hidden="true">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-4/5" />
                    </div>
                  ) : (
                    <textarea
                      id={id}
                      rows={3}
                      value={fields?.[f.k] ?? ''}
                      placeholder="Draft with AI, or write it yourself"
                      onChange={(e) => onFieldChange(f.k, e.target.value)}
                      className="mt-3 w-full resize-y rounded-md border border-line bg-paper-2/60 p-3 text-[15px] leading-relaxed text-ink outline-none placeholder:text-ink-3 focus:border-blue"
                    />
                  )}
                </div>
              )
            })}
          </section>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor={ids.when} className="label text-ink">
                Detected at
              </label>
              <input
                id={ids.when}
                type="datetime-local"
                value={detectedAtSec ? toLocalInput(detectedAtSec) : ''}
                onChange={(e) => {
                  const t = new Date(e.target.value).getTime()
                  if (!Number.isNaN(t)) onDetectedAtChange(Math.floor(t / 1000))
                }}
                className="mt-2 h-12 w-full rounded-md border border-line-strong bg-paper-2 px-3 font-mono text-[15px] text-ink outline-none focus:border-blue"
              />
              <p className="mt-1.5 text-[12px] text-ink-2">When your team first knew. The 72 hours start here.</p>
            </div>
            <div>
              <label htmlFor={ids.count} className="label text-ink">
                People affected
              </label>
              <input
                id={ids.count}
                inputMode="numeric"
                value={affected}
                placeholder="e.g. 1240"
                onChange={(e) => onAffectedChange(e.target.value.replace(/\D/g, '').slice(0, 9))}
                className="mt-2 h-12 w-full rounded-md border border-line-strong bg-paper-2 px-3 font-mono text-[15px] text-ink outline-none placeholder:text-ink-3 focus:border-blue"
              />
              <p className="mt-1.5 text-[12px] text-ink-2">Only a salted fingerprint of this number goes on chain.</p>
            </div>
          </div>
        </div>

        <aside className="flex min-w-0 flex-col gap-5 lg:col-span-5">
          <section className="relative rounded-lg border border-line bg-card p-5 md:p-6" aria-label="72-hour window">
            <RegMarks className="bg-ink" />
            {detectedAtSec ? <Countdown72 detectedAtSec={detectedAtSec} /> : <Skeleton className="h-[150px] w-full" />}
          </section>

          <section className="rounded-lg border border-line bg-card p-5" aria-live="polite" aria-label="Seal the notice">
            {gate(sealPanel)}
          </section>

          <p className="label flex items-start gap-2 text-[11px] leading-relaxed text-ai">
            <IconSpark size={13} className="mt-0.5 shrink-0" />
            AI drafts the wording only · the 72-hour check is computed by the contract
          </p>
        </aside>
      </div>
    </div>
  )
}
