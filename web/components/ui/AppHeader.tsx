'use client'

import { Suspense, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Logo } from './Logo'

export type NavItem = { href: string; label: string }

/** Floating box nav (not a pill): logo left, links centred in the bar (md+), extras right. */
export function AppHeader({
  role,
  nav,
  right,
}: {
  role: string
  nav: NavItem[]
  right?: ReactNode
}) {
  return (
    <header className="no-print sticky top-0 z-40 px-4 pt-3 md:px-6">
      <div className="mx-auto max-w-[1200px]">
        <div className="relative flex min-h-14 items-center gap-4 rounded-lg border border-line bg-card/90 px-3 backdrop-blur-md md:px-4">
          <Logo sub={role} />
          <Suspense fallback={<Nav role={role} nav={nav} path="" />}>
            <LiveNav role={role} nav={nav} />
          </Suspense>
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
      className="flex flex-1 items-stretch self-stretch md:absolute md:inset-y-0 md:left-1/2 md:flex-none md:-translate-x-1/2"
    >
      {nav.map((n) => {
        const active = n.href === path || (n.href !== '/' && path?.startsWith(n.href + '/') && !nav.some((m) => m.href !== n.href && path.startsWith(m.href) && m.href.length > n.href.length))
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? 'page' : undefined}
            className={`label relative flex items-center px-3 text-[12px] transition-colors ${
              active ? 'text-ink' : 'text-ink-2 hover:text-ink'
            }`}
          >
            {n.label}
            {active ? <span aria-hidden="true" className="absolute inset-x-3 -bottom-px h-[2px] rounded-pill bg-blue" /> : null}
          </Link>
        )
      })}
    </nav>
  )
}
