'use client'

/**
 * WorkspaceBar: the laptop (≥1024) top bar of every app area. A plain workspace header, not the landing's
 * floating card: full width, 64 px, attached to the top with a hairline under it, so the sidebar and the page
 * read as one desk (Linear, Vercel, Stripe). Left: logo + "saksi". Right: one role button (who you are)
 * whose menu holds the language switch and Switch role. Page navigation lives in the sidebar.
 * Phones keep the landing-style SiteHeader instead (AppHeader renders both and CSS picks one).
 */

import Link from 'next/link'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { ROLE_META, type Actor } from '@/components/entry/RoleChip'
import { LangToggle } from './LangToggle'
import { LogoMark } from './Logo'

export function WorkspaceBar({ actor, switchHref = '/enter' }: { actor: Actor; switchHref?: string }) {
  const meta = ROLE_META[actor]
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)
  const btn = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      btn.current?.focus()
    }
    const onDown = (e: PointerEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false)
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onDown)
    }
  }, [open])

  return (
    <header
      className="no-print sticky top-0 z-50 hidden h-16 items-center gap-3 border-b border-line bg-paper/90 px-6 backdrop-blur-[6px] lg:flex"
      style={{ '--role': meta.accent } as CSSProperties}
    >
      <Link href="/" className="flex min-h-11 items-center gap-2.5" aria-label="Saksi home">
        <LogoMark />
        <span className="text-[19px] font-semibold tracking-[-0.04em]">saksi</span>
      </Link>

      <div ref={wrap} className="relative ml-auto">
        <button
          ref={btn}
          type="button"
          aria-expanded={open}
          aria-haspopup="true"
          aria-controls="ws-menu"
          onClick={() => setOpen((v) => !v)}
          className="flex h-10 items-center gap-2.5 rounded-full border border-line bg-card pl-1.5 pr-3.5 text-[14px] font-medium text-ink transition-colors duration-150 hover:border-line-strong aria-expanded:border-line-strong"
        >
          <span aria-hidden="true" className="flex size-7 items-center justify-center rounded-full text-[12px] font-semibold text-white" style={{ background: meta.accent }}>
            {meta.initial}
          </span>
          {meta.label}
          <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" className={`text-ink-3 transition-transform duration-[220ms] ${open ? 'rotate-180' : ''}`}>
            <path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {open ? (
          <div id="ws-menu" className="ws-menu absolute right-0 top-[calc(100%+8px)] w-[280px] rounded-lg border border-line bg-card p-2 shadow-[0_24px_48px_-24px_rgb(30_26_22/0.28)]">
            <div className="flex items-center justify-between gap-3 rounded-md px-3 py-2.5">
              <span className="text-[14px] text-ink-2">Language</span>
              <LangToggle />
            </div>
            <div className="my-1 h-px bg-line" />
            <Link
              href={switchHref}
              onClick={() => setOpen(false)}
              className="flex min-h-11 items-center gap-2.5 rounded-md px-3 text-[14px] font-medium text-ink transition-colors duration-150 hover:bg-paper-2"
            >
              <svg aria-hidden="true" width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2.5 5h10l-2.5-2.5M13.5 11h-10l2.5 2.5" />
              </svg>
              Switch role
            </Link>
          </div>
        ) : null}
      </div>
    </header>
  )
}
