import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Skeleton } from '@/components/ui/Skeleton'
import { ReceiptDetail } from './ReceiptDetail'

export const metadata: Metadata = { title: 'Receipt' }

export default function ReceiptPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-4">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      }
    >
      <ReceiptDetail />
    </Suspense>
  )
}
