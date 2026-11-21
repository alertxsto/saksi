'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Suspense } from 'react'
import { IconReceipt, IconShield, IconUser } from './icons'

const TABS = [
  { href: '/citizen', label: 'Receipts', Icon: IconReceipt, match: (p: string) => p === '/citizen' || p.startsWith('/citizen/receipt') },
  { href: '/proof', label: 'Verify', Icon: IconShield, match: (p: string) => p.startsWith('/proof') },
  { href: '/citizen/profile', label: 'Profile', Icon: IconUser, match: (p: string) => p.startsWith('/citizen/profile') },
]

/** Mobile citizen tab bar: Receipts / Verify / Profile. From 1024 px of citizen-shell width the workspace sidebar replaces it. */
export function TabBar() {
  // usePathname is request data: keep it inside Suspense so dynamic routes can still prerender.
  return (
    <Suspense fallback={<Bar path="" />}>
      <LiveBar />
    </Suspense>
  )
}

function LiveBar() {
  return <Bar path={usePathname() ?? ''} />
}

function Bar({ path }: { path: string }) {
  return (
    <nav
      aria-label="Citizen"
      className="no-print fixed inset-x-0 bottom-0 z-40 @5xl:hidden border-t border-line bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md"
    >
      <ul className="mx-auto grid max-w-[430px] grid-cols-3">
        {TABS.map(({ href, label, Icon, match }) => {
          const active = match(path)
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`relative flex min-h-16 focus-visible:outline-offset-[-3px] flex-col items-center justify-center gap-1 ${active ? 'text-ink' : 'text-ink-2'}`}
              >
                {active ? <span aria-hidden="true" className="absolute inset-x-6 top-0 h-[2px] rounded-pill bg-blue" /> : null}
                <Icon size={20} strokeWidth={active ? 2 : 1.75} />
                <span className="label text-[11px]">{label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
