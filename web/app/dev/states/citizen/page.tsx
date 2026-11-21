import type { Metadata } from 'next'
import { Suspense } from 'react'
import { CitizenStatesGallery } from './Gallery'

export const metadata: Metadata = { title: 'Citizen states', robots: { index: false } }

type Search = Promise<Record<string, string | string[] | undefined>>

/** `?w=360` renders every frame at 360 px (default 390). */
export default function CitizenStatesPage({ searchParams }: { searchParams: Search }) {
  // search params are request data: read them inside Suspense (cacheComponents)
  return (
    <Suspense fallback={null}>
      <Sized searchParams={searchParams} />
    </Suspense>
  )
}

async function Sized({ searchParams }: { searchParams: Search }) {
  const w = Number((await searchParams).w)
  return <CitizenStatesGallery width={w >= 320 && w <= 430 ? w : 390} />
}
