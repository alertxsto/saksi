'use client'

import { useId, type CSSProperties, type ReactNode } from 'react'
import { AgencyPageHead, BREACH_STEPS, SealStamp, SealStepper } from '@/components/controller/AgencyKit'
import { AiChip } from '@/components/ui/AiPanel'
import { Button } from '@/components/ui/Button'
import { IconCheck, IconRefresh, IconShield, IconSpark } from '@/components/ui/icons'
import { Skeleton } from '@/components/ui/Skeleton'
import type { TxView } from '@/components/ui/TxStepper'
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
/** Shown when the AI returned only the empty template fallback: the error already says what to do next. */
export const AI_UNAVAILABLE = 'The AI is unavailable right now. Write the four parts yourself.'
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

/** Small tick list on the vault: what the contract check still needs. */
function Needs({ items }: { items: [string, boolean][] }) {
  return (
    <ul className="flex flex-col gap-2" aria-label="Before the check">
      {items.map(([t, ok]) => (
        <li key={t} className={`flex items-center gap-2.5 text-[15px] ${ok ? 'text-ink' : 'text-ink-2'}`}>
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
  // A redraft would change the text the contract check or the seal is about: only allowed before either.
  const canRedraft = !started && (check.status === 'idle' || check.status === 'error')


  // ---- seal panel: an inset group like the agency system's seal steps; the stamp marks the sealed verdict ----
  let head: ReactNode
  let body: ReactNode
  const late = mode === 'late'

  if (sealed) {
    head = (
      <div className="flex items-start justify-between gap-4">
        <div className="ag-rise flex min-w-0 flex-col items-start gap-3">
          <span
            className={`inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-pill px-3 text-[14px] font-medium tnum ${late ? 'bg-pending-bg text-pending' : 'bg-ok-bg text-ok'}`}
          >
            {late ? null : <IconCheck size={14} strokeWidth={2.6} />}
            {late ? `Sealed as late${lateBy ? ` · by ${lateBy} h` : ''}` : `Sealed on time${usedH ? ` · ${usedH.toFixed(1)} h of 72 h` : ''}`}
          </span>
          <p className="text-[19px] font-semibold leading-tight tracking-[-0.015em] text-ink">
            {late ? 'Sealed as late. That fact is now permanent.' : 'Sealed on time. Saksi witnessed it.'}
          </p>
          <p className="text-[14px] leading-relaxed text-ink-2">The regulator sees this notice on their desk now.</p>
        </div>
        <SealStamp size={92} tone={late ? 'pending' : 'blue'} text={late ? 'SEALED LATE · WITNESSED BY SAKSI ·' : 'SEALED · WITNESSED BY SAKSI · SEALED ·'} />
      </div>
    )
    body = (
      <div className="flex flex-col gap-5">
        <SealStepper tx={tx} steps={BREACH_STEPS} />
        <Button variant="light" size="sm" onClick={onReset} className="self-start">
          Start a new notice
        </Button>
      </div>
    )
  } else if (started) {
    head = <PanelHead title={late ? 'Sealing the notice as late' : 'Sealing the notice on time'} sub="Keep this tab open until the last step ticks." />
    body = <SealStepper tx={tx} steps={BREACH_STEPS} onRetry={onRetry} onReconfirm={onReconfirm} />
  } else if (check.status === 'on_time') {
    head = (
      <PanelHead
        tone="ok"
        title="The contract accepts an on-time notice"
        sub={check.deadlineSec ? `Due ${formatWIB(check.deadlineSec * 1000)}. Seal before then and the ledger records it as on time.` : undefined}
      />
    )
    body = (
      <Button variant="dark" size="lg" arrow full onClick={onAnchor} disabled={drafting} icon={<IconShield size={17} />}>
        Sign and seal the notice
      </Button>
    )
  } else if (check.status === 'late') {
    head = (
      // contract reason ClaimedWindowExpired: human copy on screen, the code only in the tooltip
      <div title="Contract: ClaimedWindowExpired">
        <PanelHead tone="late" title="The 3×24 h window has passed" sub={lateBy ? `Overdue by ${lateBy} h.` : undefined} />
      </div>
    )
    body = (
      <div className="flex flex-col gap-5">
        <p className="rounded-[12px] bg-pending-bg/60 p-4 text-[14px] leading-relaxed text-ink-2">
          The contract refuses an on-time notice for this detection time. You must still notify: the notice is sealed as late, permanently.{' '}
          <span className="text-ink">No signature was requested yet.</span>
        </p>
        <Button variant="dark" size="lg" arrow full onClick={onRecordLate} disabled={drafting}>
          Sign and seal as late
        </Button>
      </div>
    )
  } else {
    head = <PanelHead title="Ask the contract first" sub="Before you sign, Saksi asks the contract whether the notice is on time. Nothing is sent." />
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
          <p className="ag-rise flex items-start gap-2 text-[14px] leading-relaxed text-pending" role="alert">
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
          disabled={!ready || drafting || check.status === 'checking'}
          icon={check.status === 'error' ? <IconRefresh size={16} /> : undefined}
        >
          {check.status === 'checking' ? 'Asking the contract…' : check.status === 'error' ? 'Try the check again' : 'Check with the contract'}
        </Button>
      </div>
    )
  }

  const panel = (
    <section className="ag-group p-5 lg:p-6" aria-label="Seal the notice">
      {head}
      <div className="mt-5 border-t border-line pt-5">{gate(body)}</div>
    </section>
  )

  return (
    <div>
      <AgencyPageHead
        title="Breach notice"
        description="Notify the regulator within 3×24 hours of finding a breach (UU PDP Pasal 46). AI drafts the four required parts, you edit them, and the contract decides whether the notice is on time."
      />

      <div className="grid gap-6 lg:grid-cols-12 lg:gap-8">
        <div className="flex min-w-0 flex-col gap-6 lg:col-span-7">
          {/* deadline + the two values that drive it */}
          <section className="ag-group" aria-label="Notification deadline">
            <div className="p-5 lg:p-6">
              <Deadline detectedAtSec={detectedAtSec} deadlineSec={deadlineSec} nowSec={nowSec} late={check.status === 'late' || lateBy > 0} lateBy={lateBy} />
            </div>
            <div className="grid gap-5 border-t border-line p-5 sm:grid-cols-2 lg:p-6">
              <div className="flex min-w-0 flex-col gap-2">
                <label htmlFor={ids.when} className="text-[14px] font-medium text-ink">
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
                  className="ag-input tnum"
                />
                <p id={`${ids.when}-h`} className="text-[13px] text-ink-3">
                  When your team first knew. The 3×24 h start here.
                </p>
              </div>
              <div className="flex min-w-0 flex-col gap-2">
                <label htmlFor={ids.count} className="text-[14px] font-medium text-ink">
                  People affected
                </label>
                <input
                  id={ids.count}
                  inputMode="numeric"
                  value={affected}
                  placeholder="e.g. 1240"
                  onChange={(e) => onAffectedChange(e.target.value.replace(/\D/g, '').slice(0, 9))}
                  aria-describedby={`${ids.count}-h`}
                  className="ag-input tnum"
                />
                <p id={`${ids.count}-h`} className="text-[13px] text-ink-3">
                  Only a salted fingerprint of this number is sealed.
                </p>
              </div>
            </div>
          </section>

          <section className="ag-group flex flex-col gap-4 p-5 lg:p-6" aria-labelledby={`${ids.narr}-l`}>
            <div>
              <label id={`${ids.narr}-l`} htmlFor={ids.narr} className="text-[15px] font-semibold text-ink">
                Your words
              </label>
              <p className="mt-0.5 text-[14px] text-ink-2">Say what happened, plainly. AI turns it into the four required parts.</p>
            </div>
            <textarea
              id={ids.narr}
              value={narrative}
              onChange={(e) => onNarrativeChange(e.target.value)}
              rows={5}
              placeholder="e.g. Yesterday our engineer found a customer export file in a public storage bucket…"
              className="w-full resize-y rounded-[12px] border border-line-strong bg-paper p-4 text-[16px] leading-relaxed text-ink outline-none transition-colors duration-150 placeholder:text-ink-3 hover:border-ink-2 focus:border-blue focus:bg-card"
            />
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="dark"
                icon={<IconSpark size={16} className="text-ai-v" />}
                loading={drafting}
                onClick={onDraft}
                disabled={narrative.trim().length < 10 || drafting || !canRedraft}
              >
                {drafting ? 'Drafting…' : fields ? 'Redraft with AI' : 'Draft with AI'}
              </Button>
              {draft.meta ? <AiChip meta={draft.meta} /> : null}
              {narrative.trim().length < 10 && !drafting ? (
                <span className="text-[13px] text-ink-3">At least a sentence first.</span>
              ) : !canRedraft && !started && !drafting && fields ? (
                <span className="text-[13px] text-ink-3">Edit a part to redraft after the check.</span>
              ) : null}
            </div>
            {draft.status === 'error' ? (
              <p className="ag-rise flex items-start gap-2.5 text-[14px] leading-relaxed text-pending" role="alert">
                <span aria-hidden="true" className="mt-[7px] size-1.5 shrink-0 rounded-full bg-pending" />
                {draft.error === AI_UNAVAILABLE ? (
                  <span>{AI_UNAVAILABLE}</span>
                ) : (
                  <span>{draft.error ?? 'The AI could not draft this.'} You can try again or write the four parts yourself.</span>
                )}
              </p>
            ) : null}
          </section>

          <section className="ag-group" aria-label="Notice fields (a) to (d)" aria-busy={drafting}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-5 pb-3 pt-5 lg:px-6">
              <h2 className="text-[15px] font-semibold text-ink">The notice</h2>
              <span className="text-[13px] text-ink-3">UU PDP Pasal 46(2) · parts (a)–(d)</span>
            </div>
            <ol key={`fields-${draft.status}`}>
              {PASAL46_FIELDS.map((f, i) => {
                const id = `f-${f.k}`
                const isDraft = draft.status === 'done' && fields && !edited[f.k]
                return (
                  <li
                    key={f.k}
                    className={`grid gap-x-4 gap-y-2 border-t border-line px-5 py-4 sm:grid-cols-[32px_1fr] lg:px-6 ${draft.status === 'done' ? 'ctl-draft-in' : ''}`}
                    style={{ '--i': i } as CSSProperties}
                  >
                    <span aria-hidden="true" className={`hidden text-[15px] font-medium sm:block sm:pt-0.5 ${isDraft ? 'text-ai' : 'text-ink-3'}`}>
                      ({f.letter})
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center justify-between gap-3">
                        <label htmlFor={id} className="text-[15px] font-medium text-ink">
                          <span className="sm:sr-only">({f.letter}) </span>
                          {f.label}
                        </label>
                        {drafting ? null : isDraft ? (
                          <span className="inline-flex h-6 shrink-0 items-center gap-1 whitespace-nowrap rounded-pill bg-ai-bg px-2 text-[12px] font-medium text-ai">
                            <IconSpark size={11} strokeWidth={2.2} /> AI draft · edit me
                          </span>
                        ) : edited[f.k] && fields?.[f.k]?.trim() ? (
                          <span className="inline-flex h-6 shrink-0 items-center gap-1 whitespace-nowrap text-[12px] font-medium text-ok">
                            <IconCheck size={12} strokeWidth={2.6} /> Edited by you
                          </span>
                        ) : null}
                      </div>
                      {drafting && fields?.[f.k] ? (
                        <p className="ctl-stream mt-2 min-h-[76px] whitespace-pre-wrap rounded-[12px] border border-line bg-paper px-3.5 py-3 text-[15px] leading-relaxed text-ink">
                          {fields[f.k]}
                        </p>
                      ) : drafting ? (
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
                          className={`mt-2 w-full resize-y rounded-[12px] border p-3 text-[15px] leading-relaxed text-ink outline-none transition-colors duration-150 placeholder:text-ink-3 focus:border-blue focus:bg-card ${
                            isDraft ? 'border-ai/30 bg-ai-bg/25 hover:border-ai/60' : 'border-line-strong bg-paper hover:border-ink-2'
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

        <aside className="flex min-w-0 flex-col gap-3 lg:sticky lg:top-6 lg:col-span-5 lg:self-start">
          <div aria-live="polite">{panel}</div>
          <p className="flex items-start gap-2 px-1 text-[13px] leading-relaxed text-ink-3">
            <IconSpark size={13} className="mt-0.5 shrink-0 text-ai" />
            AI drafts the wording only. The contract decides whether the notice is on time.
          </p>
        </aside>
      </div>
    </div>
  )
}

function PanelHead({ title, sub, tone }: { title: string; sub?: string; tone?: 'ok' | 'late' }) {
  return (
    <div key={title} className="ag-rise">
      <p className="flex items-center gap-2 text-[17px] font-semibold leading-snug tracking-[-0.015em] text-ink">
        {tone ? <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${tone === 'ok' ? 'bg-ok' : 'bg-pending'}`} /> : null}
        {title}
      </p>
      {sub ? <p className="mt-1 text-[14px] leading-relaxed text-ink-2">{sub}</p> : null}
    </div>
  )
}

/**
 * The 3×24 h deadline in plain words (riset-ui/37 §2): Geist tabular figures, a quiet meter, amber when late,
 * never red. Before the first clock tick it shows a dash; with no detection time it says where the clock starts.
 */
function Deadline({ detectedAtSec, deadlineSec, nowSec, late, lateBy }: { detectedAtSec: number; deadlineSec: number; nowSec: number; late: boolean; lateBy: number }) {
  if (!detectedAtSec) {
    return (
      <div className="flex flex-col gap-1">
        <p className="text-[13px] text-ink-3">Notification deadline</p>
        <p className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-ink">Set the detection time to start the clock</p>
        <p className="text-[14px] text-ink-2">UU PDP Pasal 46 · 3×24 h from when your team first knew</p>
      </div>
    )
  }
  const left = deadlineSec - nowSec
  const headline = !nowSec
    ? 'Due in — h'
    : late
      ? `Overdue${lateBy ? ` by ${lateBy} h` : ''}`
      : left >= H
        ? `Due in ${Math.floor(left / H)} h`
        : `Due in ${Math.max(1, Math.ceil(left / 60))} min`
  const span = Math.max(1, deadlineSec - detectedAtSec)
  const used = nowSec ? Math.min(1, Math.max(0, (nowSec - detectedAtSec) / span)) : 0
  return (
    <div className="flex flex-col gap-4" role="timer" aria-live="off" aria-label={`${headline}. UU PDP Pasal 46, 3 times 24 hours.`}>
      <div>
        <p className="text-[13px] text-ink-3">Notification deadline</p>
        <p className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className={`text-[28px] font-semibold leading-none tracking-[-0.02em] tnum ${late ? 'text-pending' : 'text-ink'}`}>{headline}</span>
          <span className="text-[15px] text-ink-2">
            <span aria-hidden="true" className="hidden sm:inline">· </span>UU PDP Pasal 46 · 3×24 h
          </span>
        </p>
      </div>
      <div className="ag-meter" aria-hidden="true">
        <span className={late ? 'bg-pending' : 'bg-ink'} style={{ transform: `scaleX(${late ? 1 : used})` }} />
      </div>
      <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-[13px] text-ink-2 tnum">
        <span>Detected {formatWIB(detectedAtSec * 1000)}</span>
        <span className={late ? 'text-pending' : undefined}>Due {formatWIB(deadlineSec * 1000)}</span>
      </div>
    </div>
  )
}
