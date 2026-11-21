import type { Metadata } from 'next'
import { Suspense } from 'react'
import { RegulatorStates } from './RegulatorStates'

export const metadata: Metadata = { title: 'States · Regulator & proof', robots: { index: false } }

export default function RegulatorStatesPage() {
  return (
    <Suspense fallback={null}>
      <RegulatorStates />
    </Suspense>
  )
}
