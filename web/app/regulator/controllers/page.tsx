import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Skeleton } from '@/components/ui/Skeleton'
import { ControllersView } from './ControllersView'

export const metadata: Metadata = { title: 'Controllers' }

export default function ControllersPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <ControllersView />
    </Suspense>
  )
}
