'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState, type CSSProperties, type MouseEvent } from 'react'
import { LogoMark } from '@/components/ui/Logo'
import { REDUCED_QUERY, subscribe } from '@/lib/motion/scroll'
import { Cta } from './Cta'
import { OdoText } from './OdoText'

const LINKS = [
  ['#how', 'How it works'],
  ['#breach', '72 hours'],
  ['#roles', 'Roles'],
  ['#verify', 'Verify'],
  ['#faq', 'FAQ'],
  ['/why', 'Sources'],
] as const
const LINK =
  'nav-link flex min-h-11 items-center whitespace-nowrap rounded-sm px-3 text-[14px] font-medium tracking-[0.01em] transition-colors duration-150'

/**
 * zaro A.7 nav: transparent at rest, white 80% + 4 px blur + hairline after 100 px, vault colours while a
 * [data-surface="vault"] block sits under it, and it slides away while the dark closer is on screen.
 * Below lg the links live in a menu sheet that drops out of the nav box: same surface, links centred,
 * 56 px rows, words rise in (riset-ui/32).
 * Links are centred exactly (05 §4); hover is the odometer roll. `base` prefixes the section anchors when
 * the nav sits on another page (e.g. "/" on /why, so "#how" becomes "/#how").
 */
export function Nav({ base = '' }: { base?: string }) {
  const ref = useRef<HTMLElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const set = (k: string, on: boolean) => (on ? el.setAttribute(k, '') : el.removeAttribute(k))
    return subscribe(() => {
      const probe = 46
      let vault = false
      document.querySelectorAll<HTMLElement>('[data-surface="vault"]').forEach((s) => {
        const r = s.getBoundingClientRect()
        if (r.top <= probe && r.bottom >= probe) vault = true
      })
      const closer = document.getElementById('closer')
      set('data-solid', window.scrollY > 100)
      set('data-vault', vault)
      set('data-hidden', !!closer && closer.getBoundingClientRect().top < window.innerHeight * 0.55)
    })
  }, [])

  // menu: Esc / outside tap / scroll away / growing past lg all close it; focus returns to the button
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
    const lg = window.matchMedia('(min-width: 1024px)')
    const onLg = () => lg.matches && close()
    window.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('pointerdown', onDown)
    lg.addEventListener('change', onLg)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('pointerdown', onDown)
      lg.removeEventListener('change', onLg)
    }
  }, [open])

  const go = useCallback((e: MouseEvent<HTMLAnchorElement>, href: string) => {
    const target = document.querySelector(href)
    setOpen(false)
    if (!target) return
    e.preventDefault()
    const smooth = !window.matchMedia(REDUCED_QUERY).matches
    window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - (href === '#how' ? 0 : 72), behavior: smooth ? 'smooth' : 'auto' })
    history.replaceState(null, '', href)
  }, [])

  return (
    <header ref={ref} data-open={open ? '' : undefined} className="nav fixed inset-x-0 top-3 z-50 px-3 md:top-5 md:px-12">
      <div className="nav-box relative mx-auto flex h-14 max-w-[1344px] items-center rounded-lg border border-transparent pl-3 pr-1.5 md:pl-4">
        <Link href="/" className="flex min-h-11 items-center gap-2.5" aria-label="Saksi home">
          <span className="nav-mark-paper">
            <LogoMark tone="paper" />
          </span>
          <span className="nav-mark-vault hidden">
            <LogoMark tone="vault" />
          </span>
          <span className="text-[19px] font-semibold tracking-[-0.04em]">saksi</span>
        </Link>
        <nav aria-label="Sections" className="absolute inset-y-0 left-1/2 hidden -translate-x-1/2 items-center gap-1 lg:flex">
          {LINKS.map(([href, label]) =>
            href.startsWith('#') ? (
              <a key={href} href={`${base}${href}`} className={LINK}>
                <OdoText>{label}</OdoText>
              </a>
            ) : (
              <Link key={href} href={href} className={LINK}>
                <OdoText>{label}</OdoText>
              </Link>
            ),
          )}
        </nav>
        <Cta href="/citizen" size="md" className="nav-cta ml-auto max-lg:h-11 max-[379px]:hidden">
          Open live demo
        </Cta>
        <Cta href="/citizen" size="md" className="nav-cta ml-auto h-11! min-[380px]:hidden">
          Live demo
        </Cta>
        <button
          ref={btnRef}
          type="button"
          aria-expanded={open}
          aria-controls="nav-menu"
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((v) => !v)}
          className="nav-burger relative ml-1 flex size-11 shrink-0 items-center justify-center rounded-md transition-colors duration-150 lg:hidden"
        >
          <span aria-hidden="true" className="nav-burger-bar" />
          <span aria-hidden="true" className="nav-burger-bar" />
        </button>
      </div>

      <div id="nav-menu" className="nav-menu mx-auto max-w-[1344px] lg:hidden" hidden={!open}>
        <div className="nav-sheet mt-2 rounded-lg border px-3 pb-3 pt-2">
          <nav aria-label="Sections">
            <ul>
              {LINKS.map(([href, label], i) => (
                <li key={href} className="nav-sheet-row" style={{ '--i': i } as CSSProperties}>
                  <a
                    href={href.startsWith("#") ? `${base}${href}` : href}
                    onClick={(e) => go(e, href)}
                    className="nav-sheet-link flex min-h-14 items-center justify-center rounded-md text-[22px] font-medium tracking-[-0.02em] transition-colors duration-150"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="nav-sheet-row mt-2 grid grid-cols-2 gap-2" style={{ '--i': LINKS.length } as CSSProperties}>
            <Cta href="/proof" variant="light" size="md" className="nav-sheet-ghost h-12! w-full justify-center px-3!">
              Verify a receipt
            </Cta>
            <Cta href="/citizen" size="md" className="nav-cta h-12! w-full justify-between">
              Live demo
            </Cta>
          </div>
        </div>
      </div>
    </header>
  )
}
