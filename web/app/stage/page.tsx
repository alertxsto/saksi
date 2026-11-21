import type { Metadata, Viewport } from 'next'
import { StageContainer } from '@/components/stage/StageContainer'
import { CHAIN_NAME, SITE_URL } from '@/lib/env'

export const metadata: Metadata = {
  title: 'Stage',
  description: 'Live projected screen for the Saksi demo: scan to become a citizen, watch receipts get sealed.',
  robots: { index: false },
}

export const viewport: Viewport = { themeColor: '#24211D' }

/** Projected pitch screen: full viewport, no chrome, no scroll. Press F11 on the projector laptop. */
export default function StagePage() {
  return (
    <main id="main" className="stage-frame h-dvh w-full">
      <StageContainer joinUrl={`${SITE_URL}/citizen`} chainName={CHAIN_NAME} />
    </main>
  )
}
