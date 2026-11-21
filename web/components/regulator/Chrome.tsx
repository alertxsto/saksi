import { Suspense, type ReactNode } from 'react'
import { AppHeader } from '@/components/ui/AppHeader'
import { TabBar } from '@/components/ui/TabBar'
import type { RegulatorReportsWire } from '@/lib/data'
import { RegulatorSidebar, type RegNavKey } from './Sidebar'

// Same five destinations as the sidebar (kept as plain data: this file is a server module).
const NAV = [
  { href: '/regulator', label: 'Overview' },
  { href: '/regulator/reports', label: 'Citizen reports' },
  { href: '/regulator/controllers', label: 'Agencies' },
  { href: '/regulator/watch', label: 'Watch' },
  { href: '/regulator/breach', label: 'Breach notices' },
]

/**
 * Regulator shell. The shared AppHeader on top at every width (sheet menu with the same five destinations);
 * from 1024 px the 232 px workspace sidebar sits under it, beside the content. Shared by app/regulator/layout.tsx
 * and the /dev frame views, which pass `active` and a mock `loadReports` for the open-count badge.
 */
export function RegulatorChrome({
  children,
  active,
  loadReports,
}: {
  children: ReactNode
  active?: RegNavKey
  loadReports?: () => Promise<RegulatorReportsWire>
}) {
  return (
    <div className="min-h-dvh">
      <AppHeader
        actor="regulator"
        role="Regulator"
        area="regulator"
        nav={NAV}
        right={<span className="text-[13px] text-ink-3">Read-only · signed review only</span>}
      />
      <div className="lg:flex">
      {/* usePathname inside: dynamic routes (breach/[id]) need a Suspense boundary under cacheComponents. */}
      <Suspense fallback={<div aria-hidden="true" className="hidden shrink-0 lg:block lg:w-[232px]" />}>
        <RegulatorSidebar active={active} loadReports={loadReports} />
      </Suspense>
      <main id="main" className="min-w-0 flex-1 px-4 pb-24 pt-6 sm:px-6 lg:px-10 lg:pb-16 lg:pt-10">
        <div className="mx-auto w-full max-w-[1180px]">{children}</div>
      </main>
      </div>
    </div>
  )
}

/** Public verifier shell: the shared header (area links + Switch role give /proof a way out), the citizen tab bar on phones. */
export function ProofChrome({ children }: { children: ReactNode }) {
  return (
    <>
      <AppHeader
        role="Public verifier"
        area="proof"
        nav={[]}
        right={<span className="label text-[11px] text-ink-2">Runs in your browser · no login</span>}
      />
      <main id="main" className="pb-[calc(6rem+env(safe-area-inset-bottom))] pt-8 md:pt-12 lg:pb-20">
        <div className="ws">{children}</div>
      </main>
      <div className="lg:hidden">
        <TabBar />
      </div>
    </>
  )
}
