'use client'

import { OdoText } from '@/components/landing/OdoText'
import { IconArrow, IconSpinner } from '@/components/ui/icons'

/**
 * The landing `Cta` (dark variant) as a <button>, for actions that are not links ("Try again"). Same classes as
 * components/landing/Cta.tsx: r-md, h-12, colour-only hover 150 ms (.65,0,.2,1), odometer label, blue arrow tile.
 * While `busy`, the tile shows a spinner instead of the arrow.
 */
export function CtaButton({ children, onClick, busy = false, className = '' }: { children: string; onClick: () => void; busy?: boolean; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-busy={busy || undefined}
      className={`group inline-flex h-12 shrink-0 items-center gap-3 whitespace-nowrap rounded-md bg-ink pl-5 pr-1.5 text-[16px] font-medium tracking-[0.01em] text-paper transition-[background-color,border-color,color] duration-150 ease-[cubic-bezier(.65,0,.2,1)] hover:bg-[#3a332c] ${className}`}
    >
      <OdoText>{children}</OdoText>
      <span aria-hidden="true" className="flex aspect-square h-[calc(100%-12px)] items-center justify-center rounded-sm bg-blue text-white">
        {busy ? <IconSpinner size={16} /> : <IconArrow size={16} />}
      </span>
    </button>
  )
}
