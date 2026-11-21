import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Skeleton } from '@/components/ui/Skeleton'
import { ProofLink } from './ProofLink'

export const metadata: Metadata = { title: 'Proof' }

export default function ProofLinkPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <ProofLink />
    </Suspense>
  )
}
