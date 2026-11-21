import type { Metadata } from 'next'
import { Suspense } from 'react'
import { ReportGallery } from '../ReportGallery'

export const metadata: Metadata = { title: 'Citizen report states', robots: { index: false } }

type Search = Promise<Record<string, string | string[] | undefined>>

/** `?only=<index>` renders one state on its own (for 390 px screenshots). */
export default function CitizenReportStatesPage({ searchParams }: { searchParams: Search }) {
  // search params are request data: read them inside Suspense (cacheComponents)
  return (
    <Suspense fallback={null}>
      <Picked searchParams={searchParams} />
    </Suspense>
  )
}

async function Picked({ searchParams }: { searchParams: Search }) {
  const raw = (await searchParams).only
  const only = typeof raw === 'string' && /^\d+$/.test(raw) ? Number(raw) : undefined
  return <ReportGallery only={only} />
}
