'use client'

import type { ReactNode } from 'react'
import { DEFAULT_TX_COPY, TxBlock, TxFlow, txHeadline, type TxStepCopy, type TxView } from '@/components/ui/TxStepper'
import { SealChamber } from './SealChamber'

type Tone = ReturnType<typeof txHeadline>['tone']

const SUB: Record<Tone, string> = {
  idle: 'Press Seal on chain. The four steps run here.',
  live: 'Keep this tab open. The steps advance on their own.',
  done: 'The citizen’s phone shows it as RECORDED now.',
  warn: 'Your transaction is out there. Saksi keeps checking it on its own; never sign twice.',
  stopped: 'Nothing is lost. Fix what stopped it and try again.',
}

/** Status headline: what is happening now, a coloured dot (blue running, green done, amber waiting, grey stopped). */
export function ChamberHeadline({ title, sub, tone, onVault = false }: { title: string; sub?: ReactNode; tone: Tone; onVault?: boolean }) {
  const dot =
    tone === 'live'
      ? onVault
        ? 'bg-ice ctl-breathe'
        : 'bg-blue ctl-pulse-dot'
      : tone === 'done'
        ? onVault
          ? 'bg-ok-v'
          : 'bg-ok'
        : tone === 'warn'
          ? onVault
            ? 'bg-pending-v'
            : 'bg-pending'
          : onVault
            ? 'bg-vault-ink-2'
            : 'bg-ink-3'
  return (
    <div key={title} className="ctl-in flex flex-col gap-1.5">
      <p
        className={`flex items-center gap-2.5 text-[19px] font-medium leading-tight tracking-[-0.015em] md:text-[22px] ${onVault ? 'text-vault-ink' : 'text-ink'}`}
      >
        <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${dot}`} />
        {title}
      </p>
      {sub ? <p className={`max-w-[44ch] text-[14px] leading-relaxed ${onVault ? 'text-vault-ink-2' : 'text-ink-2'}`}>{sub}</p> : null}
    </div>
  )
}

/** Paper working panel: hairline card, headline on top, content under a hairline. */
export function WorkPanel({ label, head, children }: { label: string; head: ReactNode; children: ReactNode }) {
  return (
    <section aria-label={label} className="rounded-xl border border-line bg-card">
      <div className="p-5 md:p-6">{head}</div>
      <div className="border-t border-line p-5 md:p-6">{children}</div>
    </section>
  )
}

/**
 * Record-access transaction. While it runs (or stops) it is a quiet paper panel with ✓ rows; the moment it
 * confirms it turns into the vault slab with the dot-lattice check and the Doto block number: the one
 * dot-matrix moment of this screen.
 */
export function TxChamber({
  tx,
  copy = DEFAULT_TX_COPY,
  onRetry,
  onReconfirm,
}: {
  tx: TxView
  copy?: TxStepCopy
  onRetry?: () => void
  onReconfirm?: () => void
}) {
  const h = txHeadline(tx)
  if (tx.phase === 'confirmed') {
    return (
      <SealChamber
        label="Transaction"
        shape={{ shape: 'check', param: 1 }}
        title="Sealed on chain"
        status={
          <div className="flex flex-col gap-5">
            <ChamberHeadline onVault title={h.title} tone={h.tone} sub={SUB[h.tone]} />
            <TxBlock blockNumber={tx.blockNumber} />
          </div>
        }
      >
        <div className="border-t border-vault-line p-5 md:p-6">
          <TxFlow onVault tx={tx} copy={copy} />
        </div>
      </SealChamber>
    )
  }
  return (
    <WorkPanel label="Transaction" head={<ChamberHeadline title={h.title} tone={h.tone} sub={SUB[h.tone]} />}>
      <TxFlow tx={tx} copy={copy} onRetry={onRetry} onReconfirm={onReconfirm} />
    </WorkPanel>
  )
}
