import type { ReactNode } from 'react'
import { CitizenShell } from '@/app/citizen/CitizenShell'
import { WorkspaceSidebar } from '@/components/citizen-workspace/Sidebar'
import { TabBar } from '@/components/ui/TabBar'

/**
 * Verify is the citizen's third tab (Receipts / Verify / Profile), so /proof sits in the citizen shell: the
 * Citizen header, and on laptop the same sidebar as Receipts and Profile, so the sidebar never disappears when
 * you open Verify. It needs no login: anyone with a receipt link can check it. Content is a document-width
 * column (max 960). Below 1024 the citizen tab bar stays; the page's sticky action (.pf-sticky) rides above it.
 */
export function ProofFrame({ children }: { children: ReactNode }) {
  return (
    <CitizenShell sidebar={<WorkspaceSidebar />}>
      <div className="w-full @5xl:px-10 @5xl:pb-20 @5xl:pt-10">
        <div className="mx-auto w-full max-w-[960px]">{children}</div>
      </div>
      <div className="lg:hidden">
        <TabBar />
      </div>
    </CitizenShell>
  )
}
