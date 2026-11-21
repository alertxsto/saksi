import type { Metadata } from 'next'
import { Suspense } from 'react'
import { TICKET_STATES, type TicketState } from './states'
import { TicketGallery } from './TicketGallery'

export const metadata: Metadata = { title: 'Receipt ticket states', robots: { index: false } }

type Search = Promise<Record<string, string | string[] | undefined>>

/** `?s=<state>` renders one receipt-ticket state full screen; no `s` lists them. */
export default function TicketStatesPage({ searchParams }: { searchParams: Search }) {
  // search params are request data: read them inside Suspense (cacheComponents)
  return (
    <Suspense fallback={null}>
      <Picked searchParams={searchParams} />
    </Suspense>
  )
}

async function Picked({ searchParams }: { searchParams: Search }) {
  const s = (await searchParams).s
  const state = typeof s === 'string' && s in TICKET_STATES ? (s as TicketState) : null
  return <TicketGallery state={state} />
}
