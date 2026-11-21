import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Skeleton } from '@/components/ui/Skeleton'
import { BreachNotice } from './BreachNotice'

export const metadata: Metadata = { title: 'Breach notice' }

export default function BreachPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[600px] w-full" />}>
      <BreachNotice />
    </Suspense>
  )
}
