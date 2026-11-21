import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Skeleton } from '@/components/ui/Skeleton'
import { Overview } from './Overview'

export const metadata: Metadata = { title: 'Regulator overview' }

export default function RegulatorPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <Overview />
    </Suspense>
  )
}
