import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Skeleton } from '@/components/ui/Skeleton'
import { BreachList } from './BreachList'

export const metadata: Metadata = { title: 'Breach notices' }

export default function RegulatorPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <BreachList />
    </Suspense>
  )
}
