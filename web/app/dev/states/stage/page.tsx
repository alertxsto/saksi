import type { Metadata } from 'next'
import { Suspense } from 'react'
import { StageGallery } from './Gallery'

export const metadata: Metadata = { title: 'Stage states', robots: { index: false } }

// The gallery reads ?state= / ?play= on the client (useSearchParams), so the page itself stays static.
export default function StageStatesPage() {
  return (
    <Suspense>
      <StageGallery />
    </Suspense>
  )
}
