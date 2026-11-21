import { Suspense, type ReactNode } from 'react'
import { AppHeader } from '@/components/ui/AppHeader'
import { Skeleton } from '@/components/ui/Skeleton'
import { ControllerWalletProvider, WalletChips } from './wallet'

const NAV = [
  { href: '/controller', label: 'Record access' },
  { href: '/controller/breach', label: 'Breach notice' },
]

function Shell({ right, children }: { right?: ReactNode; children: ReactNode }) {
  return (
    <>
      <AppHeader role="Controller" nav={NAV} right={right} />
      <main id="main" className="px-4 pb-20 pt-8 md:px-6 md:pt-10">
        <div className="mx-auto max-w-[1200px]">{children}</div>
      </main>
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
