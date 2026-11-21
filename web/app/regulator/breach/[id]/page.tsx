import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Skeleton } from '@/components/ui/Skeleton'
import { BreachPage } from './BreachPage'

export const metadata: Metadata = { title: 'Breach notice' }

export default function Page() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <BreachPage />
    </Suspense>
  )
}
