import type { ReactNode } from 'react'
import { AppHeader } from '@/components/ui/AppHeader'
import { TabBar } from '@/components/ui/TabBar'

/**
 * Public verifier shell: the shared AppHeader (role "Verifier", no login) over a centred, document-width
 * column (max 960). Below 1024 the citizen tab bar stays (Verify is one of its three tabs); the page's
 * sticky action (.pf-sticky) rides just above it.
 */
export function ProofFrame({ children }: { children: ReactNode }) {
  return (
    <>
      <AppHeader actor="verifier" nav={[]} />
      <main id="main" className="px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-6 sm:px-6 md:pt-10 lg:pb-20">
        <div className="mx-auto w-full max-w-[960px]">{children}</div>
      </main>
      <div className="lg:hidden">
        <TabBar />
      </div>
    </>
  )
}
