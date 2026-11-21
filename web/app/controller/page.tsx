import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Skeleton } from '@/components/ui/Skeleton'
import { RecordAccess } from './RecordAccess'

export const metadata: Metadata = { title: 'Record access' }

export default function ControllerPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[600px] w-full" />}>
      <RecordAccess />
    </Suspense>
  )
}
