'use client'

/**
 * AppHeader: the one top bar for every app area (citizen, agency, regulator, verifier, presenter). It is the
 * landing nav's shell (SiteHeader): logo + "saksi" on the left at the landing's pixels, the role chip centred
 * (role name only, never a person or agency name), "Switch role" as a quiet desktop link, and the two-line
 * menu button on the right at every width. The menu sheet lists the area's pages, the `right` status and
 * Switch role. Same attached → floating scroll transition as the landing.
 *
 * Props (backward compatible with the old call sites):
 *   actor?:  'agency' | 'regulator' | 'citizen' | 'verifier' | 'operator'. Inferred from `role` / `area` if omitted.
 *   role?:   legacy area label, also accepted as an actor key. Used for the sheet's aria label.
 *   area?:   legacy, only used to infer `actor`.
 *   identity?: accepted and ignored. Who you are lives in the sidebar footer or the page, not the header.
 *   nav?:    the area's pages, listed in the menu sheet (desktop workspaces also keep their sidebars).
 *   right?:  a status chip shown in the sheet.
 *   switchHref?: where "Switch role" goes. Default "/enter".
 *   frame?:  gallery frames: sticky instead of fixed.
 *
 * Exports: AppHeader, RoleChip, ROLE_META, Actor, NavItem, AppArea, activeHref, AREAS (legacy).
 */

import { Suspense, type CSSProperties, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { OdoText } from '@/components/landing/OdoText'
import { Cta } from '@/components/landing/Cta'
import { RoleChip, ROLE_META, isActor, type Actor } from '@/components/entry/RoleChip'
import { NAV_LINK, SHEET_LINK, SheetRow, SiteHeader } from './SiteHeader'

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
  frame?: boolean
}

export function AppHeader({ actor: actorProp, role, area, nav = [], right, switchHref = '/enter', frame }: AppHeaderProps) {
  const actor = inferActor(actorProp, role, area)
  const meta = ROLE_META[actor]
  return (
    <SiteHeader
      frame={frame}
      style={{ '--role': meta.accent } as CSSProperties}
      center={
        <>
          <span className="sr-only">Signed in as </span>
          <span className="flex md:hidden">
            <RoleChip actor={actor} bare size="sm" />
          </span>
          <span className="flex max-md:hidden">
            <RoleChip actor={actor} bare />
          </span>
        </>
      }
      aside={
        <Link href={switchHref} className={`${NAV_LINK} gap-2`}>
          <SwapGlyph />
          <OdoText>Switch role</OdoText>
        </Link>
      }
      sheet={(close) => (
        <>
          {nav.length ? (
            <nav aria-label={`${meta.label} pages`}>
              <Suspense fallback={<SheetList nav={nav} path="" onPick={close} />}>
                <LiveSheetList nav={nav} onPick={close} />
              </Suspense>
            </nav>
          ) : null}
          {right ? (
            <SheetRow i={nav.length} className="flex flex-wrap items-center justify-center gap-2 px-2 pb-1 pt-3">
              {right}
            </SheetRow>
          ) : null}
          <SheetRow i={nav.length + 1} className={nav.length || right ? 'mt-3' : 'mt-1'}>
            <Cta href={switchHref} size="md" className="nav-cta h-12! w-full justify-between">
              Switch role
            </Cta>
          </SheetRow>
        </>
      )}
    />
  )
}

function SwapGlyph() {
  return (
    <svg aria-hidden="true" width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 5h10l-2.5-2.5M13.5 11h-10l2.5 2.5" />
    </svg>
  )
}

function LiveSheetList({ nav, onPick }: { nav: NavItem[]; onPick: () => void }) {
  return <SheetList nav={nav} path={usePathname() ?? ''} onPick={onPick} />
}

function SheetList({ nav, path, onPick }: { nav: NavItem[]; path: string; onPick: () => void }) {
  const current = activeHref(nav, path)
  return (
    <ul>
      {nav.map((n, i) => (
        <li key={n.href} className="nav-sheet-row" style={{ '--i': i } as CSSProperties}>
          <Link href={n.href} onClick={onPick} aria-current={n.href === current ? 'page' : undefined} className={SHEET_LINK}>
            {n.label}
          </Link>
        </li>
      ))}
    </ul>
  )
}

/** The current tab is the longest href that the path equals or sits under. */
export function activeHref(nav: NavItem[], path: string): string | undefined {
  return nav
    .filter((n) => n.href === path || path.startsWith(n.href + '/'))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href
}
