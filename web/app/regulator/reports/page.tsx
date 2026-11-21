import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Skeleton } from '@/components/ui/Skeleton'
import { ReportsQueue } from './ReportsQueue'

export const metadata: Metadata = { title: 'Citizen reports' }

export default function ReportsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <ReportsQueue />
    </Suspense>
  )
}
