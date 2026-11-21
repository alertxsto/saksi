import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Skeleton } from '@/components/ui/Skeleton'
import { ProofHome } from './ProofHome'

export const metadata: Metadata = { title: 'Verify a receipt' }

export default function ProofPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <ProofHome />
    </Suspense>
  )
}
