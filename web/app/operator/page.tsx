import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Skeleton } from '@/components/ui/Skeleton'
import { OperatorConsole } from './OperatorConsole'

export const metadata: Metadata = {
  title: 'Operator',
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
}

export default function OperatorPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <OperatorConsole />
    </Suspense>
  )
}
