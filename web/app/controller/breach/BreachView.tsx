'use client'

import { useId, type CSSProperties, type ReactNode } from 'react'
import { ConsoleHead, MetaLine } from '@/components/controller/ConsoleHead'
import { SealChamber } from '@/components/controller/SealChamber'
import { ChamberHeadline, WorkPanel } from '@/components/controller/TxChamber'
import { AiChip } from '@/components/ui/AiPanel'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Countdown72 } from '@/components/ui/Countdown72'
import { IconCheck, IconRefresh, IconShield, IconSpark } from '@/components/ui/icons'
import { Skeleton } from '@/components/ui/Skeleton'
import { DEFAULT_TX_COPY, TxFlow, txHeadline, type TxStepCopy, type TxView } from '@/components/ui/TxStepper'
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
    signing: { title: 'Sign in MetaMask', detail: mode === 'late' ? 'Your wallet signs a late notice' : 'Your wallet signs an on-time notice' },
    broadcast: DEFAULT_TX_COPY.broadcast,
    confirmed: { title: 'Confirmed', detail: 'The regulator sees this notice now' },
  }
}

/** Small tick list on the vault: what the contract check still needs. */
function Needs({ items }: { items: [string, boolean][] }) {
  return (
    <ul className="flex flex-col gap-2" aria-label="Before the check">
      {items.map(([t, ok]) => (
        <li key={t} className={`flex items-center gap-2.5 text-[14px] ${ok ? 'text-ink' : 'text-ink-2'}`}>
          <span aria-hidden="true" className={`flex size-4 shrink-0 items-center justify-center rounded-full transition-colors duration-300 ${ok ? 'bg-ok text-white' : 'border border-line-strong'}`}>
            {ok ? <IconCheck size={10} strokeWidth={3.2} /> : null}
          </span>
          {t}
          <span className="sr-only">{ok ? ' — done' : ' — missing'}</span>
        </li>
      ))}
    </ul>
  )
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
  const nowSec = now ? Math.floor(now / 1000) : 0
  const ids = { narr: useId(), when: useId(), count: useId() }
  const drafting = draft.status === 'loading'
  const complete = fieldsComplete(fields)
  const ready = complete && affected.length > 0 && detectedAtSec > 0
  // Hours past the deadline: the contract's deadline when the check returned one, else detection + 72 H.
  // 0 = not known yet (no clock tick / no detection time) → the "by N H" suffix is hidden, never "by 0 H".
  const deadlineSec = check.deadlineSec ?? (detectedAtSec > 0 ? detectedAtSec + 72 * H : 0)
  const lateBy = deadlineSec && nowSec > deadlineSec ? Math.max(1, Math.ceil((nowSec - deadlineSec) / H)) : 0
  const usedH = detectedAtSec && nowSec ? Math.max(0, (nowSec - detectedAtSec) / H) : 0
  const sealed = tx.phase === 'confirmed'
  const started = tx.phase !== 'idle'

  // ---- seal panel: a quiet paper panel while working; the vault slab only for the sealed verdict ----
  let head: ReactNode
  let body: ReactNode

  if (sealed) {
    head = null
    body = null
  } else if (started) {
    const h = txHeadline(tx)
    head = <ChamberHeadline title={h.title} tone={h.tone} sub={mode === 'late' ? 'Sealing the notice as late. Keep this tab open.' : 'Sealing the notice on time. Keep this tab open.'} />
    body = <TxFlow tx={tx} copy={breachCopy(mode ?? (check.status === 'late' ? 'late' : 'on_time'))} onRetry={onRetry} onReconfirm={onReconfirm} />
  } else if (check.status === 'on_time') {
    head = (
      <ChamberHeadline
        title="The contract accepts an on-time notice"
        tone="done"
        sub={check.deadlineSec ? `Deadline ${formatWIB(check.deadlineSec * 1000)}. Seal before then and the chain records it as on time.` : undefined}
      />
    )
    body = (
      <Button variant="dark" size="lg" arrow full onClick={onAnchor} icon={<IconShield size={17} />}>
        Seal notice on chain
      </Button>
    )
  } else if (check.status === 'late') {
    head = (
      <div className="ctl-in flex flex-col gap-2">
        {/* contract reason ClaimedWindowExpired: human copy on screen, the code only in the tooltip */}
        <p className="flex items-center gap-2 text-[13px] text-pending" title="Contract: ClaimedWindowExpired">
          <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-pending" />
          The 72-hour window has passed
        </p>
        <p className="text-[22px] font-medium leading-tight tracking-[-0.015em] text-ink">
          Record as LATE
          {lateBy ? <span className="whitespace-nowrap text-pending"> · by {lateBy} H</span> : null}
        </p>
      </div>
    )
    body = (
      <div className="flex flex-col gap-5">
        <p className="border-l-2 border-pending pl-3 text-[14px] leading-relaxed text-ink-2">
          The 72-hour window from your detection time has passed, so the contract refuses an on-time notice. You must still notify.
          It will be sealed as late, permanently. <span className="text-ink">No signature was requested yet.</span>
        </p>
        <Button variant="dark" size="lg" arrow full onClick={onRecordLate}>
          Record as LATE on chain
        </Button>
      </div>
    )
  } else {
    head = <ChamberHeadline title="Ask the contract first" tone="idle" sub="Before you sign, Saksi asks the contract whether the notice is on time. Nothing is sent." />
    body = (
      <div className="flex flex-col gap-5">
        <Needs
          items={[
            ['Parts (a)–(d) written', complete],
            ['Detection time set', detectedAtSec > 0],
            ['People affected counted', affected.length > 0],
          ]}
        />
        {check.status === 'error' ? (
          <p className="ctl-in flex items-start gap-2 text-[14px] leading-relaxed text-pending" role="alert">
            <span aria-hidden="true" className="mt-[8px] size-1.5 shrink-0 rounded-full bg-pending" />
            {check.error ?? 'Could not reach the contract.'}
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
      </div>
    )
  }

  const late = mode === 'late'
  const panel = sealed ? (
    <SealChamber
      label="Seal the notice"
      shape={late ? { shape: 'padlock' } : { shape: 'check', param: 1 }}
      title={late ? 'Sealed as late' : 'Sealed on time'}
      status={
        <div className="ctl-in flex flex-col items-start gap-3">
          <Badge onVault kind={late ? 'LATE' : 'ON_TIME'} suffix={late ? (lateBy ? `BY ${lateBy} H` : undefined) : usedH ? `${usedH.toFixed(1)} H OF 72 H` : undefined} />
          <p className="text-[19px] font-medium leading-tight tracking-[-0.015em] text-vault-ink md:text-[22px]">
            {late ? 'Sealed as late. That fact is now permanent.' : 'Sealed on time. The chain clock agrees.'}
          </p>
          <p className="text-[14px] leading-relaxed text-vault-ink-2">The regulator sees this notice on their dashboard now.</p>
        </div>
      }
    >
      <div className="flex flex-col gap-5 border-t border-vault-line p-5 md:p-6">
        {gate(
          <>
            <TxFlow onVault tx={tx} copy={breachCopy(mode ?? 'on_time')} />
            <Button variant="vault" size="sm" onClick={onReset} className="self-start">
              Start a new notice
            </Button>
          </>,
        )}
      </div>
    </SealChamber>
  ) : (
    <WorkPanel label="Seal the notice" head={head}>
      {gate(body)}
    </WorkPanel>
  )

  return (
    <div className="flex flex-col gap-10 lg:gap-12">
      <ConsoleHead
        lead="Notify within 72 hours."
        tail="The contract keeps the clock."
        aside={<MetaLine items={['UU PDP Art. 46', 'Notice text stays off chain']} />}
      >
        Tell us what happened in your own words. AI drafts the four required parts, you edit them, and the contract decides
        whether the notice is on time.
      </ConsoleHead>

      {/* the clock band: the detection time and the count drive the clock next to them */}
      <section className="grid gap-10 border-b border-line pb-10 lg:grid-cols-12 lg:gap-12" aria-label="72-hour window">
        <div className="min-w-0 lg:col-span-8">
          {detectedAtSec || !now ? (
            // before the first clock tick Countdown72 shows its own --:--:-- state
            <Countdown72 detectedAtSec={detectedAtSec} />
          ) : (
            <div className="flex min-h-[230px] flex-col justify-center gap-2 rounded-xl border border-dashed border-line-strong px-6 py-8">
              <p className="text-[19px] font-medium leading-tight tracking-[-0.015em] text-ink">The clock starts at your detection time.</p>
              <p className="text-[14px] leading-relaxed text-ink-2">Set when your team first knew, and the 72-hour window appears here.</p>
            </div>
          )}
        </div>
        <div className="flex flex-col lg:col-span-4">
          <div className="flex flex-col gap-2 pb-5">
            <label htmlFor={ids.when} className="label text-[11px] text-ink">
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
              aria-describedby={`${ids.when}-h`}
              className="h-12 w-full rounded-md border border-line-strong bg-card px-3 font-mono text-[15px] text-ink outline-none transition-colors hover:border-ink focus:border-blue"
            />
            <p id={`${ids.when}-h`} className="text-[13px] text-ink-2">
              When your team first knew. The 72 hours start here.
            </p>
          </div>
          <div className="flex flex-col gap-2 border-t border-line pt-5">
            <label htmlFor={ids.count} className="label text-[11px] text-ink">
              People affected
            </label>
            <input
              id={ids.count}
              inputMode="numeric"
              value={affected}
              placeholder="e.g. 1240"
              onChange={(e) => onAffectedChange(e.target.value.replace(/\D/g, '').slice(0, 9))}
              aria-describedby={`${ids.count}-h`}
              className="tnum h-12 w-full rounded-md border border-line-strong bg-card px-3 font-mono text-[18px] text-ink outline-none transition-colors placeholder:text-ink-3 hover:border-ink focus:border-blue"
            />
            <p id={`${ids.count}-h`} className="text-[13px] text-ink-2">
              Only a salted fingerprint of this number goes on chain.
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-12 lg:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-10 lg:col-span-7">
          <section className="flex flex-col gap-4" aria-labelledby={`${ids.narr}-l`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <label id={`${ids.narr}-l`} htmlFor={ids.narr} className="text-[19px] font-medium tracking-[-0.015em] text-ink md:text-[22px]">
                Your words
              </label>
              <span className="text-[14px] text-ink-2">Plainly. AI turns it into the four required parts.</span>
            </div>
            <textarea
              id={ids.narr}
              value={narrative}
              onChange={(e) => onNarrativeChange(e.target.value)}
              rows={5}
              placeholder="e.g. Yesterday our engineer found a customer export file in a public storage bucket…"
              className="w-full resize-y rounded-lg border border-line-strong bg-card p-4 text-[16px] leading-relaxed text-ink outline-none transition-colors placeholder:text-ink-3 hover:border-ink focus:border-blue"
            />
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="dark"
                icon={<IconSpark size={16} className="text-ai-v" />}
                loading={drafting}
                onClick={onDraft}
                disabled={narrative.trim().length < 10 || drafting}
              >
                {drafting ? 'Drafting…' : fields ? 'Redraft with AI' : 'Draft with AI'}
              </Button>
              {draft.meta ? <AiChip meta={draft.meta} /> : null}
              {narrative.trim().length < 10 && !drafting ? <span className="text-[13px] text-ink-3">At least a sentence first.</span> : null}
            </div>
            {draft.status === 'error' ? (
              <p className="ctl-in flex items-start gap-2.5 text-[14px] leading-relaxed text-pending" role="alert">
                <span aria-hidden="true" className="mt-[7px] size-1.5 shrink-0 rounded-full bg-pending" />
                <span>{draft.error ?? 'The AI could not draft this.'} You can try again or write the four parts yourself.</span>
              </p>
            ) : null}
          </section>

          <section aria-label="Notice fields (a) to (d)" aria-busy={drafting}>
            <div className="flex items-baseline justify-between gap-3 border-b border-line pb-4">
              <h2 className="text-[19px] font-medium tracking-[-0.015em] text-ink md:text-[22px]">The notice</h2>
              <span className="label text-[11px] text-ink-2">UU PDP Art. 46(2) · (a)–(d)</span>
            </div>
            <ol key={`fields-${draft.status}`}>
              {PASAL46_FIELDS.map((f, i) => {
                const id = `f-${f.k}`
                const isDraft = draft.status === 'done' && fields && !edited[f.k]
                return (
                  <li
                    key={f.k}
                    className={`grid gap-x-6 gap-y-2 border-b border-line py-5 sm:grid-cols-[44px_1fr] ${draft.status === 'done' ? 'ctl-draft-in' : ''}`}
                    style={{ '--i': i } as CSSProperties}
                  >
                    <span aria-hidden="true" className={`font-mono text-[15px] sm:pt-0.5 ${isDraft ? 'text-ai' : 'text-blue'}`}>
                      ({f.letter})
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center justify-between gap-3">
                        <label htmlFor={id} className="text-[15px] font-medium text-ink">
                          <span className="sr-only">({f.letter}) </span>
                          {f.label}
                        </label>
                        {drafting ? null : isDraft ? (
                          <span className="label inline-flex h-6 shrink-0 items-center gap-1 whitespace-nowrap rounded-pill border border-ai/40 bg-ai-bg px-2 text-[11px] text-ai">
                            <IconSpark size={11} strokeWidth={2.2} /> AI draft · edit me
                          </span>
                        ) : edited[f.k] && fields?.[f.k]?.trim() ? (
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
                          className={`mt-2 w-full resize-y rounded-md border p-3 text-[15px] leading-relaxed text-ink outline-none transition-colors placeholder:text-ink-3 focus:border-blue focus:bg-card ${
                            isDraft ? 'border-ai/30 bg-ai-bg/25 hover:border-ai/60' : 'border-line bg-card/60 hover:border-ink'
                          }`}
                        />
                      )}
                    </div>
                  </li>
                )
              })}
            </ol>
          </section>
        </div>

        <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-24 lg:col-span-5 lg:self-start">
          <div aria-live="polite">{panel}</div>
          <p className="label flex items-start gap-2 px-1 text-[11px] leading-relaxed text-ai">
            <IconSpark size={13} className="mt-0.5 shrink-0" />
            AI drafts the wording only · the 72-hour check is computed by the contract
          </p>
        </aside>
      </div>
    </div>
  )
}
