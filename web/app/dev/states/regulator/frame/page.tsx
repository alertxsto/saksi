import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Frame } from './Frame'

export const metadata: Metadata = { title: 'Frame · Regulator & proof', robots: { index: false } }

export default function RegulatorFramePage() {
  return (
    <Suspense fallback={null}>
      <Frame />
    </Suspense>
  )
}
