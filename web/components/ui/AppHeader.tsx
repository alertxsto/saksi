'use client'

import { Suspense, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { OdoText } from '@/components/landing/OdoText'
import { IconArrow } from './icons'
import { LogoMark } from './Logo'

export type NavItem = { href: string; label: string }
export type AppArea = 'controller' | 'regulator' | 'proof' | 'citizen' | 'operator'

/** The four places a visitor can move between, the same list in every app area. */
export const AREAS: { area: AppArea; href: string; label: string; hint: string }[] = [
  { area: 'controller', href: '/controller', label: 'Controller', hint: 'Record access, file breach notices' },
  { area: 'regulator', href: '/regulator', label: 'Regulator', hint: 'Breach notices and Watch' },
  { area: 'proof', href: '/proof', label: 'Verify', hint: 'Check any receipt against the chain' },
  { area: 'citizen', href: '/citizen', label: 'Citizen app', hint: 'The phone view of the person' },
]

/**
 * Shared app header for the controller, regulator, proof and operator areas.
 * Row 1 (sticky, the landing nav box): logo → home, the current area name, area links centred, "Switch role" → /enter.
 * Row 2 (scrolls with the page): the area's own tabs on the left, a status chip on the right, a hairline under both.
 * Below lg the area links and "Switch role" move into a menu sheet (Esc / outside tap / navigation close it).
 * Both rows sit on `.ws`, the workspace container that the page content uses, so the logo, the tabs and the
 * first column of content share one left edge.
 */
export function AppHeader({
  role,
  area,
  nav,
  right,
}: {
  role: string
  area?: AppArea
  nav: NavItem[]
  right?: ReactNode
}) {
  const ref = useRef<HTMLElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const sync = () => (window.scrollY > 8 ? el.setAttribute('data-solid', '') : el.removeAttribute('data-solid'))
    sync()
    window.addEventListener('scroll', sync, { passive: true })
    return () => window.removeEventListener('scroll', sync)
  }, [])

  useEffect(() => {
    if (!open) return
    const close = (focus = false) => {
      setOpen(false)
      if (focus) btnRef.current?.focus()
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close(true)
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && close()
    const lg = window.matchMedia('(min-width: 1024px)')
    const onLg = () => lg.matches && close()
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onDown)
    lg.addEventListener('change', onLg)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onDown)
      lg.removeEventListener('change', onLg)
    }
  }, [open])

  return (
    <>
      <header ref={ref} data-open={open ? '' : undefined} className="app-nav no-print sticky top-0 z-40 pt-2 md:pt-3">
        <div className="ws ws-bar">
          <div className="nav-box relative flex h-14 items-center gap-3 rounded-lg border border-transparent pl-2 pr-1.5 md:pl-4 lg:pr-4">
            <Link href="/" className="flex min-h-11 shrink-0 items-center gap-2.5 rounded-sm" aria-label="Saksi home">
              <LogoMark />
              <span className="text-[19px] font-semibold tracking-[-0.04em] text-ink">saksi</span>
            </Link>
            <span className="label whitespace-nowrap border-l border-line pl-2.5 text-[11px] text-ink-2">{role}</span>

            <nav
              aria-label="Areas"
              className="absolute inset-y-0 left-1/2 hidden -translate-x-1/2 items-center gap-0.5 lg:flex"
            >
              {AREAS.map((a) => {
                const active = a.area === area
                return (
                  <Link
                    key={a.href}
                    href={a.href}
                    aria-current={active ? 'page' : undefined}
                    className="nav-link relative flex min-h-11 items-center whitespace-nowrap rounded-sm px-3 text-[14px] font-medium tracking-[0.01em] transition-colors duration-150 ease-[cubic-bezier(.65,0,.2,1)]"
                  >
                    <OdoText>{a.label}</OdoText>
                    {active ? (
                      <span aria-hidden="true" className="absolute bottom-1.5 left-1/2 size-[5px] -translate-x-1/2 rounded-full bg-blue" />
                    ) : null}
                  </Link>
                )
              })}
            </nav>

            <Link
              href="/enter"
              className="ws-switch ml-auto hidden h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-md border border-line-strong px-4 text-[14px] font-medium tracking-[0.01em] text-ink transition-[background-color,border-color] duration-150 ease-[cubic-bezier(.65,0,.2,1)] hover:border-ink hover:bg-ink/[.06] lg:inline-flex"
            >
              <OdoText>Switch role</OdoText>
            </Link>
            <button
              ref={btnRef}
              type="button"
              aria-expanded={open}
              aria-controls="app-menu"
              aria-label={open ? 'Close menu' : 'Open menu'}
              onClick={() => setOpen((v) => !v)}
              className="nav-burger relative ml-auto flex size-11 shrink-0 items-center justify-center rounded-md transition-colors duration-150 lg:hidden"
            >
              <span aria-hidden="true" className="nav-burger-bar" />
              <span aria-hidden="true" className="nav-burger-bar" />
            </button>
          </div>

          <div id="app-menu" className="lg:hidden" hidden={!open}>
            <div className="nav-sheet mt-2 rounded-lg border px-3 pb-3 pt-2">
              <nav aria-label="Areas">
                <ul>
                  {AREAS.map((a, i) => (
                    <li key={a.href} className="nav-sheet-row" style={{ '--i': i } as CSSProperties}>
                      <Link
                        href={a.href}
                        onClick={() => setOpen(false)}
                        aria-current={a.area === area ? 'page' : undefined}
                        className="nav-sheet-link flex min-h-16 items-center justify-between gap-4 rounded-md px-3 transition-colors duration-150"
                      >
                        <span className="flex flex-col">
                          <span className="text-[19px] font-medium tracking-[-0.015em]">{a.label}</span>
                          <span className="text-[13px] text-ink-2">{a.hint}</span>
                        </span>
                        {a.area === area ? (
                          <span className="label flex items-center gap-2 text-[11px] text-ink-2">
                            <span aria-hidden="true" className="size-[5px] rounded-full bg-blue" />
                            You are here
                          </span>
                        ) : (
                          <IconArrow size={16} className="shrink-0 text-ink-3" />
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
              <div className="nav-sheet-row mt-2" style={{ '--i': AREAS.length } as CSSProperties}>
                <Link
                  href="/enter"
                  onClick={() => setOpen(false)}
                  className="flex h-12 w-full items-center justify-center rounded-md bg-ink text-[15px] font-medium text-paper transition-colors duration-150 hover:bg-[#3a332c]"
                >
                  Switch role
                </Link>
              </div>
            </div>
          </div>
        </div>
      </header>

      {nav.length || right ? (
        <div className={`ws no-print ${nav.length ? '' : 'max-md:hidden'}`}>
          <div className="flex min-h-12 items-center justify-between gap-4 border-b border-line">
            {nav.length ? (
              <Suspense fallback={<Tabs role={role} nav={nav} path="" />}>
                <LiveTabs role={role} nav={nav} />
              </Suspense>
            ) : (
              <span />
            )}
            {right ? <div className="hidden min-w-0 items-center gap-2 md:flex">{right}</div> : null}
          </div>
        </div>
      ) : null}
    </>
  )
}

function LiveTabs({ role, nav }: { role: string; nav: NavItem[] }) {
  return <Tabs role={role} nav={nav} path={usePathname() ?? ''} />
}

/** The current tab is the longest href that the path equals or sits under. */
export function activeHref(nav: NavItem[], path: string): string | undefined {
  return nav
    .filter((n) => n.href === path || path.startsWith(n.href + '/'))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href
}

function Tabs({ role, nav, path }: { role: string; nav: NavItem[]; path: string }) {
  const current = activeHref(nav, path)
  return (
    <nav aria-label={`${role} pages`} className="-ml-3 flex items-stretch self-stretch overflow-x-auto">
      {nav.map((n) => {
        const active = n.href === current
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? 'page' : undefined}
            className="ws-tab relative flex min-h-12 items-center whitespace-nowrap rounded-sm px-3 text-[14px] font-medium tracking-[0.01em] transition-colors duration-150 ease-[cubic-bezier(.65,0,.2,1)]"
          >
            <OdoText>{n.label}</OdoText>
          </Link>
        )
      })}
    </nav>
  )
}
