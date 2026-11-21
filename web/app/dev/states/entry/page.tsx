import type { Metadata } from 'next'
import { Suspense } from 'react'
import { EntryStates } from './EntryStates'

export const metadata: Metadata = { title: 'Entry states', robots: { index: false } }

type Search = Promise<Record<string, string | string[] | undefined>>

/** `?s=` one of: new, returning, checking, as-agency, as-citizen, not-registered, creating, error,
 *  header-agency, header-agency-anon, header-regulator, header-verifier. */
export default function EntryStatesPage({ searchParams }: { searchParams: Search }) {
  return (
    <Suspense fallback={null}>
      <State searchParams={searchParams} />
    </Suspense>
  )
}

async function State({ searchParams }: { searchParams: Search }) {
  const s = (await searchParams).s
  return <EntryStates s={typeof s === 'string' ? s : 'new'} />
}
