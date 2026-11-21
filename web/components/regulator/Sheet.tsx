'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { IconX } from '@/components/ui/icons'
import '@/app/regulator/regulator.css'

const CLOSE_MS = 240

/**
 * Detail sheet: slides in from the right from 1024 px (440 px wide), rises from the bottom below that.
 * 320 ms enter, 240 ms leave, instant under reduced motion. Esc, the scrim and the close button dismiss it;
 * focus moves into the sheet and returns to whatever opened it.
 */
export function Sheet({
  open,
  onClose,
  title,
  sub,
  children,
  desktop = true,
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  sub?: ReactNode
  children: ReactNode
  /** false: phones only (from 1024 the page shows the detail in a pane instead). */
  desktop?: boolean
}) {
  const [phase, setPhase] = useState<'open' | 'closing' | 'gone'>(open ? 'open' : 'gone')
  const panel = useRef<HTMLDivElement>(null)
  const opener = useRef<Element | null>(null)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (open) {
      opener.current = document.activeElement
      setPhase('open')
      return
    }
    setPhase((p) => {
      if (p === 'gone') return p
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (reduced) return 'gone'
      window.setTimeout(() => setPhase((q) => (q === 'closing' ? 'gone' : q)), CLOSE_MS)
      return 'closing'
    })
    const back = opener.current
    if (back instanceof HTMLElement) back.focus({ preventScroll: true })
  }, [open])

  useEffect(() => {
    if (phase !== 'open') return
    panel.current?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [phase, onClose])

  if (!mounted || phase === 'gone') return null

  return createPortal(
    <div className={`fixed inset-0 z-[60] ${desktop ? '' : 'lg:hidden'}`}>
      <button type="button" aria-label="Close" tabIndex={-1} onClick={onClose} data-phase={phase} className="rg2-scrim absolute inset-0 h-full w-full cursor-default" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        tabIndex={-1}
        data-phase={phase}
        className="rg2-sheet absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col rounded-t-[20px] bg-paper shadow-[0_-12px_40px_rgb(30_26_22/0.18)] outline-none lg:inset-y-0 lg:left-auto lg:right-0 lg:max-h-none lg:w-[440px] lg:rounded-none lg:rounded-l-[20px] lg:shadow-[-12px_0_40px_rgb(30_26_22/0.14)]"
      >
        <div className="flex justify-center pt-2.5 lg:hidden">
          <span aria-hidden="true" className="rg2-grabber" />
        </div>
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 pb-3.5 pt-3 lg:px-6 lg:pt-5">
          <div className="min-w-0">
            <h2 className="text-[19px] font-semibold leading-snug tracking-[-0.015em] text-ink">{title}</h2>
            {sub ? <p className="mt-0.5 text-[13px] text-ink-3">{sub}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 -mt-1 flex size-11 shrink-0 items-center justify-center rounded-md text-ink-2 transition-colors duration-150 hover:bg-ink/[.05] hover:text-ink"
          >
            <IconX size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-4 lg:px-6">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
