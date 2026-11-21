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
      <AppHeader role="Controller" nav={NAV} right={right} />
      <main id="main" className="px-4 pb-24 pt-10 md:px-6 md:pt-14">
        <div className="mx-auto max-w-[1240px]">{children}</div>
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
