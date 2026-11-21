'use client'

// Every /stage state at 1920×1080 and 1280×720 (scaled frames), plus a scripted "play" run of the real
// container (idle → citizens join → receipts arrive → a record is altered) on mock loaders.
// ?state=idle|live|alert|offline renders one state full-viewport; ?play=1 runs the sequence full-viewport.
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useState, type ReactNode } from 'react'
import { StageContainer } from '@/components/stage/StageContainer'
import { toStageModel, type StageState } from '@/components/stage/model'
import { StageView } from '@/components/stage/StageView'
import { Button } from '@/components/ui/Button'
import { CHAIN_NAME, SITE_URL } from '@/lib/env'
import { createStagePlayback, mockStageSnapshot } from '@/lib/mock'

const NOW = Date.UTC(2026, 10, 21, 7, 3)
const JOIN = `${SITE_URL}/citizen`
const STATES: StageState[] = ['idle', 'live', 'alert', 'offline']
const SIZES = [
  [1920, 1080],
  [1280, 720],
] as const
const NOTES: Record<StageState, string> = {
  idle: 'No sealed receipt yet: QR invites, padlock breathes in the empty feed.',
  live: 'Counters roll, new rows slide + scramble in, padlock recedes to the background.',
  alert: 'ALTERED > 0 wins: accent turns red, the altered row rises and flashes, headline replaces the counters.',
  offline: 'Last /api/stats call failed: last data stays, greyed; footer says Reconnecting….',
}

function StaticStage({ state }: { state: StageState }) {
  const snap = mockStageSnapshot(state, NOW)
  const model = toStageModel(snap)
  return <StageView {...model} now={NOW} joinUrl={JOIN} chainName={CHAIN_NAME} updatedAt={snap.updatedAt} />
}

function usePlayback() {
  const [run, setRun] = useState(() => ({ id: 0, loaders: createStagePlayback() }))
  const onReplay = () => setRun((r) => ({ id: r.id + 1, loaders: createStagePlayback() }))
  return { onReplay, node: <StageContainer key={run.id} joinUrl={JOIN} chainName={CHAIN_NAME} pollMs={1000} {...run.loaders} /> }
}

function Frame({ w, h, scale, children }: { w: number; h: number; scale: number; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border border-line" style={{ width: w * scale, height: h * scale }}>
      <div className="stage-frame origin-top-left" style={{ width: w, height: h, transform: `scale(${scale})` }}>
        {children}
      </div>
    </div>
  )
}

function PlayFrame() {
  const { onReplay, node } = usePlayback()
  return (
    <section className="flex w-fit flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-[20px] font-medium tracking-[-0.01em]">Play: idle → receipts arrive → alert (about 30 s)</h2>
        <Button size="sm" onClick={onReplay}>
          Replay
        </Button>
      </div>
      <Frame w={1920} h={1080} scale={0.6}>
        {node}
      </Frame>
    </section>
  )
}

export function StageGallery() {
  const params = useSearchParams()
  const only = STATES.find((s) => s === params.get('state')) ?? null
  const play = params.get('play') === '1'
  if (play || only) {
    return (
      <main id="main" className="stage-frame h-dvh w-full">
        {play ? <PlayOnly /> : <StaticStage state={only as StageState} />}
      </main>
    )
  }
  return (
    <main id="main" className="mx-auto flex max-w-[1880px] flex-col gap-14 px-6 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-[40px] font-medium tracking-[-0.03em]">Stage states</h1>
        <p className="max-w-[80ch] text-[15px] leading-relaxed text-ink-2">
          Mock data only. Full-size views:{' '}
          {STATES.map((s) => (
            <Link key={s} href={`?state=${s}`} className="mr-3 font-mono text-blue underline-offset-4 hover:underline" prefetch={false}>
              ?state={s}
            </Link>
          ))}
          <Link href="?play=1" className="font-mono text-blue underline-offset-4 hover:underline" prefetch={false}>
            ?play=1
          </Link>
          . The live screen is <code className="font-mono text-ink">/stage</code>.
        </p>
      </div>

      <PlayFrame />

      {STATES.map((s) => (
        <section key={s} className="flex flex-col gap-3">
          <h2 className="text-[20px] font-medium tracking-[-0.01em]">
            {s[0].toUpperCase() + s.slice(1)} <span className="text-ink-2">· {NOTES[s]}</span>
          </h2>
          <div className="flex flex-wrap gap-6">
            {SIZES.map(([w, h]) => (
              <figure key={w} className="flex flex-col gap-2">
                <Frame w={w} h={h} scale={864 / w}>
                  <StaticStage state={s} />
                </Frame>
                <figcaption className="font-mono text-[12px] text-ink-2">
                  {w}×{h}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      ))}
    </main>
  )
}

function PlayOnly() {
  const { node } = usePlayback()
  return node
}
