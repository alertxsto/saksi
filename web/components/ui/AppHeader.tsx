'use client'

/**
 * AppHeader: the shared top bar for the agency (controller), regulator, proof and operator areas.
 *
 * Props (all backward compatible with the old `role / area / nav / right` call sites):
 *   actor?:    'agency' | 'regulator' | 'citizen' | 'verifier' | 'operator'
 *              Picks the role chip and its accent (agency blue #2A2AE8, regulator green #157F3D).
 *              If omitted it is inferred: from `role` when that is an actor key, else from `area`
 *              (controller → agency, regulator → regulator, proof → verifier, operator → operator).
 *   identity?: string. Who you are inside the role, e.g. "Disdukcapil Kota Contoh (fiktif)".
 *              Omit when unknown: the chip then reads "Agency". Regulator defaults to
 *              "PDP authority (simulated)", verifier to "Anyone, no sign-in".
 *   role?:     string. Legacy area label ("Controller console"). Also accepted as an actor key
 *              (`role="agency"`). Used for the aria label of the tab row.
 *   area?:     AppArea. Legacy; only used to infer `actor`.
 *   nav?:      NavItem[]. The area's own tabs (row 2 on md+, listed in the sheet on phones).
 *   right?:    ReactNode. Status chip at the right end of the tab row (md+), repeated in the phone sheet.
 *   switchHref?: string. Where "Switch role" goes. Default "/enter".
 *
 * Layout. Row 1 (sticky): logo → home, the role chip, "Switch role" on the right.
 * Row 2 (scrolls with the page, md+): the tabs on the left, `right` on the right, one hairline under both.
 * Below md: a compact bar (logo, short role chip, menu) and a sheet with identity, tabs, status and Switch role.
 * The sheet closes on Esc, an outside tap, navigation, or the viewport growing past md.
 *
 * Exports: AppHeader, RoleChip, ROLE_META, Actor, NavItem, AppArea, activeHref, AREAS (legacy, unused here).
 */

import { Suspense, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { OdoText } from '@/components/landing/OdoText'
import { RoleChip, ROLE_META, isActor, type Actor } from '@/components/entry/RoleChip'
import { IconArrow } from './icons'
import { LogoMark } from './Logo'

export { RoleChip, ROLE_META, type Actor }

export type NavItem = { href: string; label: string }
export type AppArea = 'controller' | 'regulator' | 'proof' | 'citizen' | 'operator'

/** Legacy: the old cross-role area list. The header no longer links across roles (that is /enter's job). */
export const AREAS: { area: AppArea; href: string; label: string; hint: string }[] = [
  { area: 'controller', href: '/controller', label: 'Agency', hint: 'Record access, file breach notices' },
  { area: 'regulator', href: '/regulator', label: 'Regulator', hint: 'Breach notices, citizen reports, agencies' },
  { area: 'proof', href: '/proof', label: 'Verify', hint: 'Check any receipt against the ledger' },
  { area: 'citizen', href: '/citizen', label: 'Citizen', hint: 'The phone view of the person' },
]

const AREA_ACTOR: Record<AppArea, Actor> = {
  controller: 'agency',
  regulator: 'regulator',
  proof: 'verifier',
  citizen: 'citizen',
  operator: 'operator',
}

function inferActor(actor?: Actor, role?: string, area?: AppArea): Actor {
  if (actor) return actor
  const r = role?.trim().toLowerCase()
  if (isActor(r)) return r
  if (area) return AREA_ACTOR[area]
  if (r && /controller|agency|instansi/.test(r)) return 'agency'
  if (r && /regulator|pdp|komdigi/.test(r)) return 'regulator'
  if (r && /verif|proof/.test(r)) return 'verifier'
  return 'agency'
}

export type AppHeaderProps = {
  actor?: Actor
  identity?: string | null
  role?: string
  area?: AppArea
  nav?: NavItem[]
  right?: ReactNode
  switchHref?: string
}

export function AppHeader({ actor: actorProp, identity, role, area, nav = [], right, switchHref = '/enter' }: AppHeaderProps) {
  const actor = inferActor(actorProp, role, area)
  const meta = ROLE_META[actor]
  const label = role && !isActor(role.trim().toLowerCase()) ? role : meta.label
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
    const md = window.matchMedia('(min-width: 768px)')
    const onMd = () => md.matches && close()
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onDown)
    md.addEventListener('change', onMd)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onDown)
      md.removeEventListener('change', onMd)
    }
  }, [open])

  return (
    <>
      <header
        ref={ref}
        data-open={open ? '' : undefined}
        className="app-nav en-bar no-print sticky top-0 z-40 pt-2 md:pt-3"
        style={{ '--role': meta.accent } as CSSProperties}
      >
        <div className="ws ws-bar">
          <div className="nav-box relative flex h-14 items-center gap-2.5 rounded-lg border border-transparent pl-2 pr-1.5 md:gap-3 md:pl-4 md:pr-2">
            <Link href="/" className="flex min-h-11 shrink-0 items-center gap-2.5 rounded-sm" aria-label="Saksi home">
              <LogoMark />
              <span className="text-[19px] font-semibold tracking-[-0.04em] text-ink max-[379px]:hidden">saksi</span>
            </Link>
            <span aria-hidden="true" className="h-6 w-px shrink-0 bg-line" />

            <span className="sr-only">Signed in as </span>
            <RoleChip actor={actor} identity={identity} className="min-w-0 max-md:hidden" />
            <RoleChip actor={actor} identity={identity} size="sm" className="md:hidden" />

            <Link
              href={switchHref}
              className="en-switch ml-auto hidden h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-pill border border-line-strong pl-3.5 pr-4 text-[14px] font-medium tracking-[0.01em] text-ink md:inline-flex"
            >
              <SwapGlyph />
              <OdoText>Switch role</OdoText>
            </Link>
            <button
              ref={btnRef}
              type="button"
              aria-expanded={open}
              aria-controls="app-menu"
              aria-label={open ? 'Close menu' : 'Open menu'}
              onClick={() => setOpen((v) => !v)}
              className="nav-burger relative ml-auto flex size-11 shrink-0 items-center justify-center rounded-md transition-colors duration-150 md:hidden"
            >
              <span aria-hidden="true" className="nav-burger-bar" />
              <span aria-hidden="true" className="nav-burger-bar" />
            </button>
          </div>

          <div id="app-menu" className="md:hidden" hidden={!open}>
            <div className="en-sheet mt-2 rounded-lg border border-line bg-card">
              <div className="en-sheet-row en-sheet-id" style={{ '--i': 0 } as CSSProperties}>
                <span aria-hidden="true" className="en-sheet-disc">
                  {meta.initial}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="text-[13px] text-ink-3">You are signed in as</span>
                  <span className="truncate text-[17px] font-semibold tracking-[-0.01em] text-ink">{meta.label}</span>
                  <span className="text-[14px] leading-[1.4] text-ink-2">{identity ?? meta.defaultIdentity ?? meta.blurb}</span>
                </span>
              </div>

              {nav.length ? (
                <nav aria-label={`${label} pages`} className="en-sheet-row px-2 pt-1" style={{ '--i': 1 } as CSSProperties}>
                  <SheetLinks nav={nav} onPick={() => setOpen(false)} />
                </nav>
              ) : null}

              {right ? (
                <div className="en-sheet-row flex flex-wrap items-center gap-2 px-4 pt-3" style={{ '--i': 2 } as CSSProperties}>
                  {right}
                </div>
              ) : null}

              <div className="en-sheet-row p-3" style={{ '--i': 3 } as CSSProperties}>
                <Link
                  href={switchHref}
                  onClick={() => setOpen(false)}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-pill bg-ink text-[15px] font-medium text-paper transition-colors duration-150 hover:bg-[#3a332c]"
                >
                  <SwapGlyph />
                  Switch role
                </Link>
              </div>
            </div>
          </div>
        </div>
      </header>

      {nav.length || right ? (
        <div className="ws no-print max-md:hidden">
          <div className="flex min-h-12 items-center justify-between gap-4 border-b border-line">
            {nav.length ? (
              <Suspense fallback={<Tabs label={label} nav={nav} path="" />}>
                <LiveTabs label={label} nav={nav} />
              </Suspense>
            ) : (
              <span />
            )}
            {right ? <div className="flex min-w-0 items-center gap-2">{right}</div> : null}
          </div>
        </div>
      ) : null}
    </>
  )
}

function SwapGlyph() {
  return (
    <svg aria-hidden="true" width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 5h10l-2.5-2.5M13.5 11h-10l2.5 2.5" />
    </svg>
  )
}

function SheetLinks({ nav, onPick }: { nav: NavItem[]; onPick: () => void }) {
  return (
    <Suspense fallback={<SheetList nav={nav} path="" onPick={onPick} />}>
      <LiveSheetList nav={nav} onPick={onPick} />
    </Suspense>
  )
}

function LiveSheetList({ nav, onPick }: { nav: NavItem[]; onPick: () => void }) {
  return <SheetList nav={nav} path={usePathname() ?? ''} onPick={onPick} />
}

function SheetList({ nav, path, onPick }: { nav: NavItem[]; path: string; onPick: () => void }) {
  const current = activeHref(nav, path)
  return (
    <ul className="flex flex-col">
      {nav.map((n) => {
        const active = n.href === current
        return (
          <li key={n.href}>
            <Link
              href={n.href}
              onClick={onPick}
              aria-current={active ? 'page' : undefined}
              className="en-sheet-link flex min-h-12 items-center justify-between gap-4 rounded-md px-3 text-[16px] font-medium text-ink"
            >
              {n.label}
              {active ? (
                <span aria-hidden="true" className="en-sheet-dot" />
              ) : (
                <IconArrow size={15} className="shrink-0 text-ink-3" />
              )}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

function LiveTabs({ label, nav }: { label: string; nav: NavItem[] }) {
  return <Tabs label={label} nav={nav} path={usePathname() ?? ''} />
}

/** The current tab is the longest href that the path equals or sits under. */
export function activeHref(nav: NavItem[], path: string): string | undefined {
  return nav
    .filter((n) => n.href === path || path.startsWith(n.href + '/'))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href
}

function Tabs({ label, nav, path }: { label: string; nav: NavItem[]; path: string }) {
  const current = activeHref(nav, path)
  return (
    <nav aria-label={`${label} pages`} className="-ml-3 flex items-stretch self-stretch overflow-x-auto">
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
