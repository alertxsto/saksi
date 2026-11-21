'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Suspense } from 'react'
import { IconReceipt, IconShield, IconUser } from './icons'
import '@/app/citizen/stub-list.css'

const TABS = [
  { href: '/citizen', label: 'Receipts', Icon: IconReceipt, match: (p: string) => p === '/citizen' || p.startsWith('/citizen/receipt') },
  { href: '/proof', label: 'Verify', Icon: IconShield, match: (p: string) => p.startsWith('/proof') },
  { href: '/citizen/profile', label: 'Profile', Icon: IconUser, match: (p: string) => p.startsWith('/citizen/profile') },
]

/** Mobile citizen tab bar, a floating ink pill (riset-ui/36 A): Receipts / Verify / Profile. From 1024 px of citizen-shell width the workspace sidebar replaces it. */
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
    <>
      {/* In-flow spacer: with the shell's bottom padding it keeps the last row clear of the floating bar. */}
      <div aria-hidden="true" className="no-print h-8 shrink-0 @5xl:hidden" />
      <nav
        aria-label="Citizen"
        className="no-print pointer-events-none fixed inset-x-0 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 flex justify-center px-4 @5xl:hidden"
      >
        <ul className="pointer-events-auto flex h-[58px] w-full max-w-[320px] items-center gap-1 rounded-pill bg-ink p-1.5 shadow-[0_12px_30px_rgb(30_26_22/0.25)]">
          {TABS.map(({ href, label, Icon, match }) => {
            const active = match(path)
            return (
              <li key={href} className="flex-1">
                <Link
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={`sl-tab flex h-[46px] items-center justify-center gap-2 rounded-pill text-[14px] font-medium focus-visible:outline-offset-[-3px] ${
                    active ? 'bg-paper text-ink' : 'text-paper/70 hover:text-paper'
                  }`}
                >
                  <Icon size={18} strokeWidth={active ? 2 : 1.75} />
                  <span className={active ? '' : 'sr-only'}>{label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </>
  )
}
