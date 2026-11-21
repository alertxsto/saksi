import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { SystemGallery } from './Gallery'
import { SYSTEM_STATES, type SystemState } from './states'

export const metadata: Metadata = { title: 'System screens', robots: { index: false } }

const LIVE = [
  ['/this-page-does-not-exist', 'Root not-found (wrong URL)'],
  ['/dev/system/throw?for=12', 'Live error.tsx: a server page that fails for 12 s, then recovers via auto-retry'],
  ['/dev/og', 'OG image source (1200×630)'],
  ['/dev/og/icon', 'apple-touch-icon source (180×180)'],
] as const

type Search = Promise<Record<string, string | string[] | undefined>>

/** /dev/system?s=404|receipt|proof|error|checking|offline renders one screen full-size; no param = index. */
export default function SystemStatesPage({ searchParams }: { searchParams: Search }) {
  // search params are request data: read them inside Suspense (cacheComponents)
  return (
    <Suspense fallback={null}>
      <SystemStates searchParams={searchParams} />
    </Suspense>
  )
}

async function SystemStates({ searchParams }: { searchParams: Search }) {
  const { s } = await searchParams
  const state = SYSTEM_STATES.find((x) => x === s) as SystemState | undefined
  if (state) return <SystemGallery state={state} />
  return (
    <main id="main" className="chrome py-12">
      <h1 className="display text-[40px]">System screens</h1>
      <ul className="mt-8 divide-y divide-line border-y border-line">
        {SYSTEM_STATES.map((x) => (
          <li key={x}>
            <Link href={`/dev/system?s=${x}`} className="flex min-h-12 items-center justify-between gap-4 py-3 hover:text-blue">
              <span className="font-mono text-[14px]">?s={x}</span>
            </Link>
          </li>
        ))}
        {LIVE.map(([href, note]) => (
          <li key={href}>
            <Link href={href} className="flex min-h-12 items-center justify-between gap-4 py-3 hover:text-blue">
              <span className="font-mono text-[14px]">{href}</span>
              <span className="text-right text-[14px] text-ink-2">{note}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  )
}
