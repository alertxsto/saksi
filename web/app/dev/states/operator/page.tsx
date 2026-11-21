import type { Metadata } from 'next'
import { Suspense } from 'react'
import { OperatorGallery } from './Gallery'

export const metadata: Metadata = { title: 'Operator states', robots: { index: false } }

export default function OperatorStatesPage() {
  return (
    <Suspense>
      <OperatorGallery />
    </Suspense>
  )
}
