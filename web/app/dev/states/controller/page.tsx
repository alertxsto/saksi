import type { Metadata } from 'next'
import { Suspense } from 'react'
import { ControllerGallery } from './Gallery'

export const metadata: Metadata = { title: 'Agency states', robots: { index: false } }

export default function ControllerStatesPage() {
  return (
    <Suspense>
      <ControllerGallery />
    </Suspense>
  )
}
