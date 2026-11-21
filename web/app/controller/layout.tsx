import { Suspense, type ReactNode } from 'react'
import { AppHeader } from '@/components/ui/AppHeader'
import { Skeleton } from '@/components/ui/Skeleton'
import { ConsoleReveal } from '@/components/controller/ConsoleReveal'
import { ControllerWalletProvider, WalletChips } from './wallet'

const NAV = [
  { href: '/controller', label: 'Record access' },
  { href: '/controller/breach', label: 'Breach notice' },
]

function Shell({ right, children }: { right?: ReactNode; children: ReactNode }) {
  return (
    <>
      <AppHeader role="Controller console" area="controller" nav={NAV} right={right} />
      <main id="main" className="pb-24 pt-8 md:pt-12">
        <div className="ws">{children}</div>
      </main>
      <ConsoleReveal />
    </>
  )
}

export default function ControllerLayout({ children }: LayoutProps<'/controller'>) {
  return (
    <Suspense
      fallback={
        <Shell>
          <Skeleton className="h-[600px] w-full" />
        </Shell>
      }
    >
      <ControllerWalletProvider>
        <Shell right={<WalletChips />}>{children}</Shell>
      </ControllerWalletProvider>
    </Suspense>
  )
}
