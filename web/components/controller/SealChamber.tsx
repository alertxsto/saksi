'use client'

import type { ReactNode } from 'react'
import type { ShapeName } from '@/components/landing/lattice/shapes'
import { txErrorKind, type TxView } from '@/components/ui/TxStepper'
import { LatticeStatic } from './LatticeStatic'

export type ChamberShape = { shape: ShapeName; param?: number }

/**
 * The landing's SEAL step as a lattice object, one shape per transaction phase:
 * idle = the record (receipt) → preparing = fingerprint → signing = padlock → broadcast = block →
 * confirmed = verified check. A sent-but-unconfirmed tx shows the clock; refused ones return to the receipt.
 */
export function shapeForTx(tx: TxView): ChamberShape {
  switch (tx.phase) {
    case 'idle':
      return { shape: 'receipt' }
    case 'preparing':
      return { shape: 'fingerprint' }
    case 'signing':
      return { shape: 'padlock' }
    case 'broadcast':
      return { shape: 'block', param: 1 }
    case 'confirmed':
      return { shape: 'check', param: 1 }
    case 'error':
      return txErrorKind(tx.error, Boolean(tx.txHash)) === 'timeout' ? { shape: 'clock', param: 0.62 } : { shape: 'receipt' }
  }
}

/**
 * Dark vault slab (hero language) holding the lattice object and whatever the step needs underneath.
 * One slab per screen; content inside is hairline-divided, never boxed again.
 */
export function SealChamber({
  shape,
  title,
  label,
  status,
  children,
  className = '',
}: {
  shape: ChamberShape
  /** Accessible name of the lattice object (it changes with the step). */
  title: string
  /** Region label for screen readers. */
  label: string
  /** Top-right status (badge / live text). */
  status?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section aria-label={label} className={`vault grain overflow-hidden rounded-xl bg-vault text-vault-ink ${className}`}>
      <div className="relative z-[1] flex flex-col">
        <div className="flex items-start gap-5 p-5 md:p-6">
          <div className="w-[140px] shrink-0 md:w-[172px]">
            <LatticeStatic key={`${shape.shape}${shape.param ?? ''}`} shape={shape.shape} param={shape.param} title={title} className="ctl-swap" />
          </div>
          <div className="min-w-0 flex-1 pt-1">{status}</div>
        </div>
        {children}
      </div>
    </section>
  )
}
