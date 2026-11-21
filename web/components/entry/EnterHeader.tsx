'use client'

import Link from 'next/link'
import type { CSSProperties } from 'react'
import { IconArrow } from '@/components/ui/icons'
import { OdoText } from '@/components/landing/OdoText'
import { Cta } from '@/components/landing/Cta'
import { NAV_LINK, SHEET_LINK, SheetRow, SiteHeader } from '@/components/ui/SiteHeader'

const LINKS = [
  ['/', 'Home'],
  ['/why', 'Real cases'],
  ['/integrate', 'Integrate'],
] as const

/** /enter top bar: the landing nav shell (SiteHeader). No role yet, so no chip; "Back to home" on desktop, the menu everywhere. */
export function EnterHeader() {
  return (
    <SiteHeader
      menuId="enter-menu"
      aside={
        <Link href="/" className={`${NAV_LINK} group gap-2`}>
          <IconArrow size={15} className="rotate-180 transition-transform duration-150 group-hover:-translate-x-0.5" />
          <OdoText>Back to home</OdoText>
        </Link>
      }
      sheet={(close) => (
        <>
          <nav aria-label="Saksi">
            <ul>
              {LINKS.map(([href, label], i) => (
                <li key={href} className="nav-sheet-row" style={{ '--i': i } as CSSProperties}>
                  <Link href={href} onClick={close} className={SHEET_LINK}>
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <SheetRow i={LINKS.length} className="mt-2">
            <Cta href="/proof" variant="light" size="md" className="nav-sheet-ghost h-12! w-full justify-center px-3!">
              Verify a receipt
            </Cta>
          </SheetRow>
        </>
      )}
    />
  )
}
