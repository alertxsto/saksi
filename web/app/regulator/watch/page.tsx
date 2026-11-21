import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Skeleton } from '@/components/ui/Skeleton'
import { WatchView } from './WatchView'

export const metadata: Metadata = { title: 'Watch' }

export default function WatchPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <WatchView />
    </Suspense>
  )
}
