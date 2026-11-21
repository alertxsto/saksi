'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ComponentType } from 'react'
import { RoleChip } from '@/components/entry/RoleChip'
import { IconArrow, IconClock, IconEye, IconShield, IconUser } from '@/components/ui/icons'
import { getRegulatorReports, type RegulatorReportsWire } from '@/lib/data'

type IconProps = { size?: number; strokeWidth?: number; className?: string }

function IconOverview({ size = 18, strokeWidth = 1.75, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} className={className} aria-hidden="true">
      <rect x="3.5" y="3.5" width="7" height="7" rx="2" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="2" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="2" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="2" />
    </svg>
  )
}

export type RegNavKey = 'overview' | 'reports' | 'agencies' | 'watch' | 'breach'

export const REG_NAV: Array<{ key: RegNavKey; href: string; label: string; Icon: ComponentType<IconProps> }> = [
  { key: 'overview', href: '/regulator', label: 'Overview', Icon: IconOverview },
  { key: 'reports', href: '/regulator/reports', label: 'Citizen reports', Icon: IconUser },
  { key: 'agencies', href: '/regulator/controllers', label: 'Agencies', Icon: IconShield },
  { key: 'watch', href: '/regulator/watch', label: 'Watch', Icon: IconEye },
  { key: 'breach', href: '/regulator/breach', label: 'Breach notices', Icon: IconClock },
]

export function navKeyFor(path: string): RegNavKey | undefined {
  if (path === '/regulator') return 'overview'
  if (path.startsWith('/regulator/reports')) return 'reports'
  if (path.startsWith('/regulator/controllers')) return 'agencies'
  if (path.startsWith('/regulator/watch')) return 'watch'
  if (path.startsWith('/regulator/breach')) return 'breach'
  return undefined
}

/** Open citizen reports for the nav badge. Shares the live ['regulator-reports','live'] cache with the queue. */
export function useOpenReports(load?: () => Promise<RegulatorReportsWire>): number | undefined {
  const q = useQuery({
    queryKey: ['regulator-reports', load ? 'gallery-nav' : 'live'],
    queryFn: load ?? getRegulatorReports,
    refetchInterval: load ? false : 5000,
    refetchIntervalInBackground: false,
    retry: false,
  })
  return q.data ? q.data.reports.filter((r) => r.status === 'open').length : undefined
}

/**
 * Desktop sidebar (from 1024, under the shared AppHeader): five destinations, and a footer with who
 * you are and Switch role. 232 px, the workspace grammar of riset-ui/37 §4.
 */
export function RegulatorSidebar({ active, loadReports }: { active?: RegNavKey; loadReports?: () => Promise<RegulatorReportsWire> }) {
  const path = usePathname()
  const current = active ?? navKeyFor(path)
  const open = useOpenReports(loadReports)

  return (
    <aside
      aria-label="Regulator workspace"
      className="no-print sticky top-(--hdr) hidden h-[calc(100dvh-var(--hdr))] w-[232px] shrink-0 flex-col overflow-y-auto border-r border-t border-line bg-paper-2/55 lg:flex"
    >
      <nav aria-label="Regulator" className="px-3 pt-4">
        <ul className="flex flex-col gap-0.5">
          {REG_NAV.map(({ key, href, label, Icon }) => {
            const on = current === key
            return (
              <li key={key}>
                <Link
                  href={href}
                  aria-current={on ? 'page' : undefined}
                  className={`flex h-10 items-center gap-3 rounded-md px-2.5 text-[15px] transition-colors duration-150 ${
                    on ? 'bg-ink font-medium text-paper' : 'text-ink-2 hover:bg-ink/[.05] hover:text-ink'
                  }`}
                >
                  <Icon size={18} strokeWidth={on ? 2 : 1.75} />
                  <span className="flex-1 truncate">{label}</span>
                  {key === 'reports' && open ? (
                    <span
                      aria-label={`${open} open`}
                      className={`tnum flex h-5 min-w-5 items-center justify-center rounded-pill px-1.5 text-[12px] font-semibold ${
                        on ? 'bg-paper text-ink' : 'bg-blue text-white'
                      }`}
                    >
                      {open}
                    </span>
                  ) : null}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="mt-auto flex flex-col gap-3 border-t border-line px-4 pb-5 pt-4">
        <RoleChip actor="regulator" identity="PDP authority (simulated)" className="max-w-full" />
        <p className="text-[12px] leading-snug text-ink-3">Reads the witness record. Can only sign a review, never edit a record.</p>
        <Link href="/enter" className="flex min-h-9 w-fit items-center gap-1.5 text-[13px] font-medium text-ink-2 hover:text-blue">
          Switch role <IconArrow size={13} />
        </Link>
      </div>
    </aside>
  )
}
