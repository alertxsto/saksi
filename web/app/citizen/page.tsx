import type { Metadata } from 'next'
import { Suspense } from 'react'
import { ReceiptCardSkeleton } from '@/components/ui/Skeleton'
import { CitizenHome } from './CitizenHome'

export const metadata: Metadata = { title: 'Your receipts' }

export default function CitizenPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-3">
          <ReceiptCardSkeleton />
          <ReceiptCardSkeleton />
        </div>
      }
    >
      <CitizenHome />
    </Suspense>
  )
}
