'use client'

import { CitizenShell } from '@/app/citizen/CitizenShell'
import { NotFoundScreen } from '@/components/system/NotFoundScreen'
import { ReconnectView, type ReconnectPhase, RETRY_EVERY } from '@/components/system/ReconnectScreen'
import { TabBar } from '@/components/ui/TabBar'
import type { SystemState } from './states'


const noop = () => {}

/** Every system screen with fixed props (no countdown running). Real routes: see /dev/system. */
export function SystemGallery({ state }: { state: SystemState }) {
  switch (state) {
    case '404':
      return <NotFoundScreen kind="page" />
    case 'receipt':
      // same tree as app/citizen/receipt/[eventId]/not-found.tsx inside the citizen layout
      return (
        <CitizenShell>
          <NotFoundScreen kind="receipt" chrome="embedded" stack requested="evt_7f3a9c2e41d8" />
          <TabBar />
        </CitizenShell>
      )
    case 'proof':
      return (
        <main id="main" className="px-4 pb-20 pt-8 md:px-6 md:pt-12">
          <div className="mx-auto max-w-[1200px]">
            <NotFoundScreen kind="proof" chrome="embedded" requested="0x9c1e…4b27 · 3" />
          </div>
        </main>
      )
    default: {
      const phase: ReconnectPhase = state === 'error' ? 'waiting' : state
      return <ReconnectView phase={phase} secondsLeft={RETRY_EVERY - 2} attempt={state === 'error' ? 1 : 2} reference="3829416075" onRetry={noop} />
    }
  }
}
