import type { Metadata } from 'next'
import { Suspense } from 'react'
import { ProofGallery } from './Gallery'
import { PROOF_STATES, type ProofState } from './states'

export const metadata: Metadata = { title: 'Proof states', robots: { index: false } }

type Search = Promise<Record<string, string | string[] | undefined>>

/** `/dev/states/proof?s=<state>` renders one state full screen in the real proof frame; no `s` lists them. */
export default function ProofStatesPage({ searchParams }: { searchParams: Search }) {
  return (
    <Suspense fallback={null}>
      <Pick searchParams={searchParams} />
    </Suspense>
  )
}

async function Pick({ searchParams }: { searchParams: Search }) {
  const s = (await searchParams).s
  const state = typeof s === 'string' && s in PROOF_STATES ? (s as ProofState) : null
  return <ProofGallery state={state} />
}
