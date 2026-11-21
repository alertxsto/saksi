'use client'

import { useId, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { IconAlert, IconCheck, IconCopy, IconShield } from '@/components/ui/icons'
import {
  copyText,
  REPORT_NOTE_MAX,
  REPORT_REASON_LABEL,
  REPORT_REASONS,
  sendReport,
  type AutoVerdict,
  type ReportInput,
  type ReportReason,
  type ReportReceipt,
  type ReportVerdict,
} from '@/lib/data'
import { shortHex } from '@/lib/format'

type Phase = 'idle' | 'open' | 'sending' | 'sent' | 'already' | 'error'

const REASON_HINT: Record<ReportReason, string> = {
  not_me: 'You never dealt with this agency, or not at this time.',
  object: 'The access happened, but you do not agree with why.',
  altered: 'Your phone showed this receipt as changed or missing.',
}
const VERDICT_WORDS: Record<ReportVerdict, string> = {
  MATCH: 'The agency’s record still matches the sealed record.',
  ALTERED: 'The agency’s record no longer matches the sealed record.',
  DELETED: 'The record is gone from the agency’s side but still on the public ledger.',
  NOT_FOUND: 'The public ledger has not confirmed this receipt yet.',
}

/**
 * "Report to the regulator" for one receipt: pick one of three fixed reasons, add an optional note, send.
 * The server re-checks the receipt against the chain and stores its own verdict with the report.
 * `chain` is only for a receipt the server no longer returns (kept on this phone); `send` / `initial` are for /dev.
 */
export function ReportAccess({
  eventId,
  verdict,
  chain,
  onDone,
  send = sendReport,
  initial,
}: {
  eventId: string
  verdict?: AutoVerdict
  chain?: ReportInput['chain']
  onDone?: (receipt: ReportReceipt) => void
  send?: (input: ReportInput) => Promise<ReportReceipt>
  initial?: { phase?: Phase; reason?: ReportReason; note?: string; receipt?: ReportReceipt; error?: string }
}) {
  const id = useId()
  const [phase, setPhase] = useState<Phase>(initial?.phase ?? 'idle')
  const [reason, setReason] = useState<ReportReason | null>(initial?.reason ?? (verdict === 'altered' ? 'altered' : null))
  const [note, setNote] = useState(initial?.note ?? '')
  const [receipt, setReceipt] = useState<ReportReceipt | null>(initial?.receipt ?? null)
  const [error, setError] = useState<string | null>(initial?.error ?? null)
  const [copied, setCopied] = useState(false)
  // The check can finish after this block mounted: an altered verdict then preselects that reason if none is picked.
  const [seenVerdict, setSeenVerdict] = useState(verdict)
  if (verdict !== seenVerdict) {
    setSeenVerdict(verdict)
    if (verdict === 'altered' && !reason) setReason('altered')
  }

  const onOpen = () => setPhase('open')
  const onCancel = () => {
    setPhase('idle')
    setError(null)
  }
  const onSend = async () => {
    if (!reason) return
    setPhase('sending')
    setError(null)
    try {
      const sent = await send({ eventId, reason, note: note.trim() || null, ...(chain ? { chain } : {}) })
      setReceipt(sent)
      setPhase('sent')
      onDone?.(sent)
    } catch (e) {
      const code = (e as { code?: string }).code
      if (code === 'ALREADY_REPORTED') {
        setPhase('already')
        return
      }
      setError(e instanceof Error && e.message ? e.message : 'Could not send the report. Try again.')
      setPhase('error')
    }
  }
  const onCopy = (text: string) => {
    copyText(text).then(
      () => setCopied(true),
      () => setCopied(false),
    )
  }

  if (phase === 'idle') {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="flex min-h-14 w-full items-center gap-3 rounded-lg border border-line bg-card px-4 text-left transition-colors duration-150 hover:border-line-strong"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-paper-2 text-ink">
          <IconShield size={17} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-[16px] font-medium text-ink">Report to the regulator</span>
          <span className="text-[14px] text-ink-2">Don’t recognise this access, or object to it?</span>
        </span>
        <span aria-hidden="true" className="text-[20px] leading-none text-ink-3">›</span>
      </button>
    )
  }

  if (phase === 'sent' || phase === 'already') {
    return (
      <section role="status" aria-live="polite" className="anim-rise overflow-hidden rounded-lg border border-line bg-card">
        <div className="flex items-start gap-3 px-4 py-4">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ok-bg text-ok">
            <IconCheck size={18} strokeWidth={2.4} />
          </span>
          <span className="flex min-w-0 flex-col gap-1">
            <span className="text-[16px] font-medium text-ink">{phase === 'sent' ? 'Sent to the regulator' : 'Already sent'}</span>
            <span className="text-[14px] leading-relaxed text-ink-2">
              {phase === 'sent'
                ? 'The regulator sees the agency, the action and your masked code. Not the purpose text.'
                : 'You reported this access for the same reason before. The regulator already has it.'}
            </span>
          </span>
        </div>
        {receipt ? (
          <dl className="border-t border-line text-[14px]">
            <div className="ml-4 flex items-center justify-between gap-4 py-3 pr-4">
              <dt className="text-ink-2">Report ID</dt>
              <dd className="flex min-w-0 items-center gap-2">
                <span className="truncate font-mono text-[13px] text-ink">{shortHex(receipt.id, 8, 4)}</span>
                <button
                  type="button"
                  onClick={() => onCopy(receipt.id)}
                  aria-label={copied ? 'Report ID copied' : 'Copy report ID'}
                  className="flex size-9 shrink-0 items-center justify-center rounded-md text-ink-2 hover:bg-paper-2 hover:text-ink"
                >
                  {copied ? <IconCheck size={15} /> : <IconCopy size={15} />}
                </button>
              </dd>
            </div>
            <div className="ml-4 flex items-start justify-between gap-4 border-t border-line py-3 pr-4">
              <dt className="shrink-0 text-ink-2">Saksi’s check</dt>
              <dd className="text-right text-ink">{VERDICT_WORDS[receipt.serverVerdict]}</dd>
            </div>
            <div className="ml-4 flex items-center justify-between gap-4 border-t border-line py-3 pr-4">
              <dt className="text-ink-2">Reason</dt>
              <dd className="text-right text-ink">{REPORT_REASON_LABEL[receipt.reason]}</dd>
            </div>
          </dl>
        ) : null}
      </section>
    )
  }

  const sending = phase === 'sending'
  return (
    <section aria-labelledby={`${id}-h`} className="anim-rise flex flex-col gap-3">
      <div className="flex flex-col gap-1 px-1">
        <h3 id={`${id}-h`} className="text-[15px] font-semibold text-ink">
          Report to the regulator
        </h3>
        <p className="text-[14px] leading-relaxed text-ink-2">
          Saksi attaches its own check of this receipt against the public ledger, so you don’t need to prove anything.
        </p>
      </div>

      <fieldset disabled={sending} className="overflow-hidden rounded-lg border border-line bg-card">
        <legend className="sr-only">Why are you reporting this access?</legend>
        {REPORT_REASONS.map((r, i) => {
          const checked = reason === r
          return (
            <label
              key={r}
              className={`flex min-h-16 cursor-pointer items-center gap-3 py-3 pl-4 pr-4 transition-colors duration-150 hover:bg-paper/60 ${
                i ? 'relative before:absolute before:left-4 before:right-0 before:top-0 before:h-px before:bg-line' : ''
              }`}
            >
              <input type="radio" name={`${id}-reason`} value={r} checked={checked} onChange={() => setReason(r)} className="peer sr-only" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-[16px] font-medium text-ink">{REPORT_REASON_LABEL[r]}</span>
                <span className="text-[14px] text-ink-2">{REASON_HINT[r]}</span>
              </span>
              <span
                aria-hidden="true"
                className={`flex size-6 shrink-0 items-center justify-center rounded-full border transition-colors duration-150 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-blue ${
                  checked ? 'border-blue bg-blue text-white' : 'border-line-strong bg-card'
                }`}
              >
                {checked ? <IconCheck size={14} strokeWidth={2.6} /> : null}
              </span>
            </label>
          )
        })}
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-note`} className="px-1 text-[15px] font-semibold text-ink">
          Add a note <span className="font-normal text-ink-2">(optional)</span>
        </label>
        <textarea
          id={`${id}-note`}
          value={note}
          disabled={sending}
          maxLength={REPORT_NOTE_MAX}
          rows={3}
          onChange={(e) => setNote(e.target.value)}
          placeholder="For example: I closed this account last year."
          className="w-full resize-none rounded-lg border border-line bg-card px-4 py-3 text-[16px] leading-relaxed text-ink placeholder:text-ink-3 focus:border-ink focus:outline-none"
        />
        <span className="flex justify-between gap-3 px-1 text-[13px] text-ink-2">
          <span>Regulator reports are visible on the public regulator page. Leave out personal details.</span>
          <span className="shrink-0 tnum">
            {note.length}/{REPORT_NOTE_MAX}
          </span>
        </span>
      </div>

      {phase === 'error' && error ? (
        <p role="alert" className="flex items-start gap-2 px-1 text-[14px] text-ink">
          <IconAlert size={16} className="mt-0.5 shrink-0 text-ink-2" />
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row-reverse">
        <Button variant="dark" arrow full loading={sending} disabled={!reason || sending} onClick={() => void onSend()}>
          {sending ? 'Sending…' : phase === 'error' ? 'Try again' : 'Send report'}
        </Button>
        <Button variant="ghost" full disabled={sending} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </section>
  )
}
