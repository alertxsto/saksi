import type { ReactNode } from 'react'
import { AppHeader } from '@/components/ui/AppHeader'
import { Chip } from '@/components/ui/Chip'
import { IconShield } from '@/components/ui/icons'
import { TabBar } from '@/components/ui/TabBar'

const NAV = [
  { href: '/regulator', label: 'Breach notices' },
  { href: '/regulator/watch', label: 'Watch' },
  { href: '/regulator/reports', label: 'Citizen reports' },
  { href: '/regulator/controllers', label: 'Controllers' },
]

/** Regulator shell (header + main). Shared by app/regulator/layout.tsx and the /dev frame views. */
export function RegulatorChrome({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="contents print:hidden">
        <AppHeader
          role="Regulator"
          area="regulator"
          nav={NAV}
          right={
            <Chip icon={<IconShield size={12} />} tone="ink">
              Read-only · from chain
            </Chip>
          }
        />
      </div>
      <main id="main" className="pb-24 pt-8 md:pt-12">
        <div className="ws">{children}</div>
      </main>
    </>
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
      <main id="main" className="pb-[calc(5rem+env(safe-area-inset-bottom))] pt-8 md:pb-20 md:pt-12">
        <div className="ws">{children}</div>
      </main>
      <div className="md:hidden">
        <TabBar />
      </div>
    </>
  )
}
