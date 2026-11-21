import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Skeleton } from '@/components/ui/Skeleton'
import { AccessLog } from './AccessLog'

export const metadata: Metadata = { title: 'Access log' }

export default function AccessLogPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[600px] w-full" />}>
      <AccessLog />
    </Suspense>
  )
}
