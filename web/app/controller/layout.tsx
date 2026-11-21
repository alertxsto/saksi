'use client'

import { Suspense, type ReactNode } from 'react'
import { AgencyShell } from '@/components/controller/AgencyShell'
import { Skeleton } from '@/components/ui/Skeleton'
import { ControllerWalletProvider, useControllerWallet } from './wallet'

function Shell({ children }: { children: ReactNode }) {
  const { wallet } = useControllerWallet()
  return <AgencyShell wallet={wallet}>{children}</AgencyShell>
}

export default function ControllerLayout({ children }: LayoutProps<'/controller'>) {
  return (
    <Suspense
      fallback={
        <AgencyShell wallet={{ state: 'disconnected', isChecking: true }}>
          <Skeleton className="h-[600px] w-full" />
        </AgencyShell>
      }
    >
      <ControllerWalletProvider>
        <Shell>{children}</Shell>
      </ControllerWalletProvider>
    </Suspense>
  )
}
