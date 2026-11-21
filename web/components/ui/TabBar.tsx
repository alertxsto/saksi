'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Suspense, useLayoutEffect, useState, type CSSProperties } from 'react'
import { IconReceipt, IconShield, IconUser } from './icons'
import '@/app/citizen/stub-list.css'

const TABS = [
  { href: '/citizen', label: 'Receipts', Icon: IconReceipt, match: (p: string) => p === '/citizen' || p.startsWith('/citizen/receipt') },
  { href: '/proof', label: 'Verify', Icon: IconShield, match: (p: string) => p.startsWith('/proof') },
  { href: '/citizen/profile', label: 'Profile', Icon: IconUser, match: (p: string) => p.startsWith('/citizen/profile') },
]

// Each page mounts its own TabBar, so the tab you left is kept outside React, written when a tab is tapped
// (not on mount: Next can mount the next route's tree early). The new screen's indicator slides from it.
// sessionStorage carries it across reloads.
const KEY = 'saksi.tabbar'
let last: number | null = null

function readLast(): number | null {
  if (last !== null) return last
  try {
    const v = sessionStorage.getItem(KEY)
    return v === null ? null : Number(v)
  } catch {
    return null
  }
}

function writeLast(i: number) {
  last = i
  try {
    sessionStorage.setItem(KEY, String(i))
  } catch {}
}

/**
 * Mobile citizen tab bar, a floating ink pill (riset-ui/36 A): Receipts / Verify / Profile, icon over an
 * always-visible label. A paper indicator slides between tabs (280 ms, riset-ui/37 §5 enter curve), also
 * across navigations. From 1024 px of citizen-shell width the workspace sidebar replaces it.
 */
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
  const idx = TABS.findIndex((t) => t.match(path))
  const [pos, setPos] = useState(idx)
  const [anim, setAnim] = useState(false)

  // before paint: park the indicator on the previous screen's tab, then let it travel to this one
  useLayoutEffect(() => {
    if (idx < 0) return
    const prev = readLast()
    if (prev === null || prev < 0 || prev === idx) {
      setPos(idx)
      return
    }
    setAnim(false)
    setPos(prev)
    let r2 = 0
    const r1 = requestAnimationFrame(() => {
      r2 = requestAnimationFrame(() => {
        setAnim(true)
        setPos(idx)
      })
    })
    return () => {
      cancelAnimationFrame(r1)
      cancelAnimationFrame(r2)
    }
  }, [idx])

  return (
    <>
      {/* In-flow spacer: with the shell's bottom padding it keeps the last row clear of the floating bar. */}
      <div aria-hidden="true" className="no-print h-8 shrink-0 @5xl:hidden" />
      <nav
        aria-label="Citizen"
        className="no-print pointer-events-none fixed inset-x-0 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 flex justify-center px-4 @5xl:hidden"
      >
        <ul className="tb-pill pointer-events-auto relative grid h-16 w-full max-w-[340px] grid-cols-3 rounded-pill bg-ink p-1.5 shadow-[0_12px_30px_rgb(30_26_22/0.25)]">
          {pos >= 0 ? (
            <li
              aria-hidden="true"
              className="tb-ind pointer-events-none absolute inset-y-1.5 left-1.5 w-[calc((100%-12px)/3)] rounded-pill bg-paper"
              data-anim={anim ? '' : undefined}
              style={{ '--x': pos } as CSSProperties}
            />
          ) : null}
          {TABS.map(({ href, label, Icon }, i) => {
            const active = i === idx
            return (
              <li key={href} className="relative">
                <Link
                  href={href}
                  onClick={() => writeLast(idx)}
                  aria-current={active ? 'page' : undefined}
                  className={`sl-tab tb-tab flex h-full flex-col items-center justify-center gap-1 rounded-pill text-[12px] font-medium leading-none focus-visible:outline-offset-[-3px] ${
                    active ? 'text-ink' : 'text-paper/70 hover:text-paper'
                  }`}
                >
                  <Icon size={19} strokeWidth={active ? 2 : 1.75} />
                  <span>{label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </>
  )
}
