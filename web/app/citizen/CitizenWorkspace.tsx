'use client'

import { useParams, useSelectedLayoutSegment } from 'next/navigation'
import { Suspense, type ReactNode } from 'react'
import { CitizenHome } from './CitizenHome'

/**
 * Keeps the receipts list mounted across /citizen and /citizen/receipt/[id], so on a laptop picking a row
 * only swaps the detail pane (no remount, no replayed motion). The route's page is the pane: an empty
 * "Select a receipt" on /citizen, the receipt on /citizen/receipt/[id]. Phones see one side at a time.
 */
export function CitizenWorkspace({ children }: { children: ReactNode }) {
  // The segment and params are request data on the dynamic receipt route: resolve them inside Suspense.
  return (
    <Suspense fallback={children}>
      <Routed>{children}</Routed>
    </Suspense>
  )
}

function Routed({ children }: { children: ReactNode }) {
  const segment = useSelectedLayoutSegment()
  const params = useParams<{ eventId?: string }>()
  if (segment !== null && segment !== 'receipt') return <>{children}</>
  const selectedId = segment === 'receipt' && params?.eventId ? decodeURIComponent(params.eventId) : undefined
  return <CitizenHome pane={children} focus={segment === 'receipt' ? 'pane' : 'list'} selectedId={selectedId} />
}
