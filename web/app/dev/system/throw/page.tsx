import { connection } from 'next/server'
import { Suspense } from 'react'

// Dev-only failure simulator for app/error.tsx. The first request with a given ?k starts a clock; every
// render fails until ?for seconds have passed, then the page recovers. Exercises the 5 s auto-retry.
const started = new Map<string, number>()

type Search = Promise<Record<string, string | string[] | undefined>>

export default function ThrowingPage({ searchParams }: { searchParams: Search }) {
  return (
    <Suspense fallback={null}>
      <Failing searchParams={searchParams} />
    </Suspense>
  )
}

async function Failing({ searchParams }: { searchParams: Search }) {
  await connection()
  const q = await searchParams
  const key = typeof q.k === 'string' ? q.k : 'default'
  const seconds = Number(typeof q.for === 'string' ? q.for : 12)
  if (!started.has(key)) started.set(key, Date.now())
  const elapsed = (Date.now() - (started.get(key) ?? 0)) / 1000
  if (elapsed < seconds) throw new Error(`Chain RPC unreachable (dev simulation, ${Math.ceil(seconds - elapsed)} s left)`)
  return (
    <main id="main" className="chrome py-16">
      <h1 className="display text-[40px]">Reconnected.</h1>
      <p className="mt-3 text-ink-2">The page recovered after {seconds} s without a reload.</p>
    </main>
  )
}
