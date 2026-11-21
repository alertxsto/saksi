'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { LogoMark } from '@/components/ui/Logo'
import { subscribe } from '@/lib/motion/scroll'
import { Cta } from './Cta'
import { OdoText } from './OdoText'

const LINKS = [
  ['#how', 'How it works'],
  ['#breach', '72 hours'],
  ['#roles', 'Roles'],
  ['#verify', 'Verify'],
  ['#faq', 'FAQ'],
] as const

/**
 * zaro A.7 nav: transparent at rest, white 80% + 4 px blur + hairline after 100 px, vault colours while a
 * [data-surface="vault"] block sits under it, and it slides away while the dark closer is on screen.
 * Links are centred exactly (05 §4); hover is the odometer roll.
 */
export function Nav() {
  const ref = useRef<HTMLElement>(null)

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

  return (
    <header ref={ref} className="nav fixed inset-x-0 top-3 z-50 px-3 md:top-5 md:px-12">
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
          {LINKS.map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="nav-link flex min-h-11 items-center whitespace-nowrap rounded-sm px-3 text-[14px] font-medium tracking-[0.01em] transition-colors duration-150"
            >
              <OdoText>{label}</OdoText>
            </a>
          ))}
        </nav>
        <Cta href="/citizen" size="md" className="nav-cta ml-auto">
          Open live demo
        </Cta>
      </div>
    </header>
  )
}
