'use client'

/**
 * SiteHeader: the landing nav's shell (components/landing/Nav.tsx), shared by every app area so the logo,
 * the wordmark, the menu button and the scroll behaviour sit at the same pixels everywhere.
 *
 *   fixed, top 12 / 20 px, side gutter 12 / 48 px, a 56 px box capped at 1344 px, logo at 24 / 64 px.
 *   At rest the box is transparent and reads as part of the page; once the page scrolls it becomes the
 *   floating card (white 80 %, 4 px blur, hairline): the same `.nav[data-solid] .nav-box` rule as the landing.
 *
 * Slots: `center` (absolutely centred, like the landing links), `aside` (desktop-only quiet link before the
 * menu button, like the landing's "Sign in"), `sheet(close)` (the menu sheet body; full width on phones,
 * a 400 px panel on the right from lg). An in-flow spacer keeps content clear of the fixed bar; pages and
 * sticky sidebars use `var(--hdr)` (68 / 76 px) for the same offset.
 * `frame` (gallery frames): sticky instead of fixed, so several headers can sit on one page.
 */

import Link from 'next/link'
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { subscribe } from '@/lib/motion/scroll'
import { LogoMark } from './Logo'

export const NAV_LINK =
  'nav-link flex min-h-11 items-center whitespace-nowrap rounded-sm px-3 text-[14px] font-medium tracking-[0.01em] transition-colors duration-150'

export function SiteHeader({
  center,
  aside,
  sheet,
  frame = false,
  style,
  menuId = 'app-menu',
}: {
  center?: ReactNode
  aside?: ReactNode
  sheet: (close: () => void) => ReactNode
  frame?: boolean
  style?: CSSProperties
  menuId?: string
}) {
  const ref = useRef<HTMLElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)

  // attached → floating: same surface switch as the landing nav, earlier threshold because app content starts right under the bar
  useEffect(() => {
    const el = ref.current
    if (!el) return
    return subscribe(() => (window.scrollY > 8 ? el.setAttribute('data-solid', '') : el.removeAttribute('data-solid')))
  }, [])

  // menu: Esc / outside tap / scrolling away all close it; focus returns to the button on Esc
  useEffect(() => {
    if (!open) return
    const close = (focus = false) => {
      setOpen(false)
      if (focus) btnRef.current?.focus()
    }
    const y0 = window.scrollY
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close(true)
    const onScroll = () => Math.abs(window.scrollY - y0) > 48 && close()
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && close()
    window.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('pointerdown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('pointerdown', onDown)
    }
  }, [open])

  return (
    <>
      <header
        ref={ref}
        data-open={open ? '' : undefined}
        style={style}
        className={`nav app-nav no-print inset-x-0 z-50 px-3 md:px-12 ${frame ? 'sticky top-0 pt-3 md:pt-5' : 'fixed top-3 md:top-5'}`}
      >
        <div className="nav-box relative mx-auto flex h-14 max-w-[1344px] items-center rounded-lg border border-transparent pl-3 pr-1.5 md:pl-4">
          <Link href="/" className="relative z-[1] flex min-h-11 items-center gap-2.5" aria-label="Saksi home">
            <LogoMark />
            <span className="text-[19px] font-semibold tracking-[-0.04em]">saksi</span>
          </Link>
          {center ? <div className="absolute inset-y-0 left-1/2 flex -translate-x-1/2 items-center">{center}</div> : null}
          {aside ? <div className="relative z-[1] ml-auto mr-1 hidden lg:flex">{aside}</div> : null}
          <button
            ref={btnRef}
            type="button"
            aria-expanded={open}
            aria-controls={menuId}
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((v) => !v)}
            className={`nav-burger relative z-[1] flex size-11 shrink-0 items-center justify-center rounded-md transition-colors duration-150 ${aside ? 'ml-auto lg:ml-1' : 'ml-auto'}`}
          >
            <span aria-hidden="true" className="nav-burger-bar" />
            <span aria-hidden="true" className="nav-burger-bar" />
          </button>
        </div>

        <div id={menuId} className="nav-menu mx-auto max-w-[1344px]" hidden={!open}>
          {open ? (
            <div className="nav-sheet mt-2 rounded-lg border px-3 pb-3 pt-2 lg:ml-auto lg:max-w-[400px]">{sheet(() => setOpen(false))}</div>
          ) : null}
        </div>
      </header>
      {frame ? null : <div aria-hidden="true" className="no-print h-(--hdr) shrink-0" />}
    </>
  )
}

/** One centred 56 px sheet row, the landing menu's link. */
export const SHEET_LINK =
  'nav-sheet-link flex min-h-14 items-center justify-center rounded-md text-[22px] font-medium tracking-[-0.02em] transition-colors duration-150'

export function SheetRow({ i, children, className = '' }: { i: number; children: ReactNode; className?: string }) {
  return (
    <div className={`nav-sheet-row ${className}`} style={{ '--i': i } as CSSProperties}>
      {children}
    </div>
  )
}
