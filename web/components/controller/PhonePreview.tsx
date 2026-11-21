'use client'

import { LogoMark } from '@/components/ui/Logo'
import { ReceiptCard } from '@/components/ui/ReceiptCard'
import type { LegalBasisKey, ReceiptOpening } from '@/lib/shared/types'
import { LEGAL_BASES } from '@/lib/shared/types'

const clock = (ms: number) => {
  if (!ms) return '--:--'
  const d = new Date(ms)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/**
 * "What the citizen will see": the citizen's phone, cropped at the bottom edge, with the receipt this
 * form will create at the top of their list (NOW bucket, NEW · JUST ARRIVED). The bridge of the story:
 * the controller types here, the citizen reads it there. Inert; nothing in it is a real link.
 */
export function PhonePreview({
  opening,
  code,
  legalBasisKey,
  now,
}: {
  opening: ReceiptOpening
  /** Citizen code as typed so far (the citizen sees their own code in their app). */
  code: string
  legalBasisKey: LegalBasisKey
  now: number
}) {
  const slots = (code + '······').slice(0, 6)
  return (
    <figure className="flex flex-col items-center gap-5">
      <div
        className="w-full max-w-[344px] rounded-[44px] border border-line-strong bg-card p-[9px] shadow-[0_24px_48px_-36px_rgba(30,26,22,0.35)]"
        inert
      >
        <div className="ctl-phone-fade relative h-[468px] overflow-hidden rounded-[36px] border border-line bg-paper">
          {/* status bar */}
          <div className="flex h-11 items-center justify-between px-6 font-mono text-[12px] font-medium text-ink">
            <span className="tnum">{clock(now)}</span>
            <span aria-hidden="true" className="h-[22px] w-[86px] rounded-pill bg-ink" />
            <span aria-hidden="true" className="flex items-end gap-[2px]">
              {[5, 7, 9, 11].map((h) => (
                <span key={h} className="w-[3px] rounded-[1px] bg-ink" style={{ height: h }} />
              ))}
            </span>
          </div>

          <div className="flex flex-col gap-4 px-4 pb-6 pt-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <LogoMark size={20} />
                <span className="text-[17px] font-semibold tracking-[-0.04em] text-ink">saksi</span>
              </span>
              <span className="label inline-flex h-7 items-center rounded-pill bg-vault px-2.5 font-mono text-[12px] tracking-[0.18em] text-vault-ink">
                {slots}
              </span>
            </div>
            <p className="text-[24px] font-medium leading-[1.1] tracking-[-0.02em] text-ink">
              Your receipts
            </p>

            <div className="flex items-center gap-3">
              <span className="label text-[11px] text-blue">Now</span>
              <span className="h-px flex-1 bg-line" />
            </div>
            <div key={opening.eventType} className="ctl-swap">
              <ReceiptCard opening={opening} now={now} isNew />
            </div>
            <p className="flex items-baseline font-mono text-[12px] text-ink-2">
              <span className="label text-[11px]">Legal basis</span>
              <span className="leader" aria-hidden="true" />
              <span className="text-ink">
                {LEGAL_BASES[legalBasisKey]} ({legalBasisKey.slice(-1)})
              </span>
            </p>

            <div className="flex items-center gap-3 pt-1">
              <span className="label text-[11px] text-ink-2">Earlier</span>
              <span className="h-px flex-1 bg-line" />
            </div>
            {[0, 1].map((i) => (
              <div key={i} aria-hidden="true" className="flex gap-3.5 rounded-lg border border-line bg-card p-4 opacity-60">
                <span className="size-11 shrink-0 rounded-sm bg-paper-2" />
                <span className="flex flex-1 flex-col gap-2 pt-1">
                  <span className="h-3 w-4/5 rounded-pill bg-paper-2" />
                  <span className="h-3 w-1/2 rounded-pill bg-paper-2" />
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <figcaption className="flex max-w-[344px] flex-col items-center gap-1 text-center">
        <span className="text-[15px] font-medium text-ink">What the citizen will see</span>
        <span className="text-[14px] leading-relaxed text-ink-2">On their phone, seconds after the seal confirms. Exactly these words.</span>
      </figcaption>
    </figure>
  )
}
