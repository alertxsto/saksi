'use client'

import { Suspense, useEffect, useRef, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { OdoText } from '@/components/landing/OdoText'
import { Logo } from './Logo'

export type NavItem = { href: string; label: string }

/**
 * The landing Nav (components/landing/Nav) in app form, same box: px-3 / md:px-12 page inset, 1344 max, h-14,
 * r-lg, pl-3 md:pl-4 pr-1.5, 14 px medium odometer links centred, extras right. Transparent at rest; card +
 * blur + hairline once the page scrolls (zaro A.7). The current link carries a 5 px blue dot.
 */
export function AppHeader({
  role,
  nav,
  right,
}: {
  role: string
  nav: NavItem[]
  right?: ReactNode
}) {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const sync = () => (window.scrollY > 8 ? el.setAttribute('data-solid', '') : el.removeAttribute('data-solid'))
    sync()
    window.addEventListener('scroll', sync, { passive: true })
    return () => window.removeEventListener('scroll', sync)
  }, [])

  return (
    <header ref={ref} className="app-nav no-print sticky top-0 z-40 px-3 pt-3 md:px-12 md:pt-5">
      <div className="mx-auto max-w-[1344px]">
        <div className="nav-box relative flex h-14 items-center gap-4 rounded-lg border border-transparent pl-3 pr-1.5 md:pl-4">
          <Logo sub={role} />
          {nav.length ? (
            <Suspense fallback={<Nav role={role} nav={nav} path="" />}>
              <LiveNav role={role} nav={nav} />
            </Suspense>
          ) : null}
          <div className="ml-auto hidden items-center gap-2 md:flex">{right}</div>
        </div>
      </div>
    </header>
  )
}

function LiveNav({ role, nav }: { role: string; nav: NavItem[] }) {
  return <Nav role={role} nav={nav} path={usePathname() ?? ''} />
}

function Nav({ role, nav, path }: { role: string; nav: NavItem[]; path: string }) {
  return (
    <nav
      aria-label={`${role} navigation`}
      className="flex flex-1 items-stretch justify-end gap-0.5 self-stretch md:absolute md:inset-y-0 md:left-1/2 md:flex-none md:-translate-x-1/2 md:justify-center"
    >
      {nav.map((n) => {
        const active = n.href === path || (n.href !== '/' && path?.startsWith(n.href + '/') && !nav.some((m) => m.href !== n.href && path.startsWith(m.href) && m.href.length > n.href.length))
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? 'page' : undefined}
            className={`nav-link relative flex min-h-11 items-center whitespace-nowrap rounded-sm px-2.5 text-[14px] font-medium tracking-[0.01em] transition-colors duration-150 ease-[cubic-bezier(.65,0,.2,1)] md:px-3`}
          >
            <OdoText>{n.label}</OdoText>
            {active ? <span aria-hidden="true" className="absolute bottom-1.5 left-1/2 size-[5px] -translate-x-1/2 rounded-full bg-blue" /> : null}
          </Link>
        )
      })}
    </nav>
  )
}
