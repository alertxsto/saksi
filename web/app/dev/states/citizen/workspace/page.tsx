import type { Metadata } from 'next'
import { Suspense } from 'react'
import { WORKSPACE_STATES, type WorkspaceState } from './states'
import { CitizenWorkspaceGallery } from './WorkspaceGallery'

export const metadata: Metadata = { title: 'Citizen workspace states', robots: { index: false } }

type Search = Promise<Record<string, string | string[] | undefined>>

/** `?s=<state>` renders one laptop workspace state full screen; no `s` lists them. */
export default function CitizenWorkspaceStatesPage({ searchParams }: { searchParams: Search }) {
  // search params are request data: read them inside Suspense (cacheComponents)
  return (
    <Suspense fallback={null}>
      <Picked searchParams={searchParams} />
    </Suspense>
  )
}

async function Picked({ searchParams }: { searchParams: Search }) {
  const s = (await searchParams).s
  const state = typeof s === 'string' && s in WORKSPACE_STATES ? (s as WorkspaceState) : null
  return <CitizenWorkspaceGallery state={state} />
}
