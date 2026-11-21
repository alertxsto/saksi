'use client'

import { useSearchParams } from 'next/navigation'
import { useState, type ReactNode } from 'react'
import { ProofChrome, RegulatorChrome } from '@/components/regulator/Chrome'
import { BreachDetailLoader } from '../../../../regulator/BreachDetail'
import { BreachList } from '../../../../regulator/BreachList'
import { WatchView } from '../../../../regulator/watch/WatchView'
import { ReportsQueue } from '../../../../regulator/reports/ReportsQueue'
import { ControllersView } from '../../../../regulator/controllers/ControllersView'
import { Overview } from '../../../../regulator/Overview'
import type { RegNavKey } from '@/components/regulator/Sidebar'
import { mockControllerRegister, mockRegulatorReports, mockReviewReport } from '@/lib/mock'
import { ProofIncomplete } from '../../../../proof/[tx]/[logIndex]/ProofLink'
import { ProofHome } from '../../../../proof/ProofHome'
import { ProofResult } from '../../../../proof/ProofResult'
import { RiseHeading } from '@/components/regulator/Rise'
import { NotFoundScreen } from '@/components/system/NotFoundScreen'
import { arrivingReports, detail, list, replayWatch, SAMPLE, verify, watch } from '../loaders'

function ReplayWatch() {
  const [load] = useState(() => replayWatch())
  return <WatchView load={load} />
}

function Shared({ demo }: { demo: 'match' | 'altered' | 'notfound' }) {
  return (
    <div className="flex flex-col gap-10 md:gap-12">
      <RiseHeading
        as="h1"
        lead="A citizen shared this receipt."
        tail="Check it against the chain."
        className="text-[34px] leading-[1.04] md:text-[56px]"
      />
      <ProofResult opening={SAMPLE} verify={verify(demo)} autoStart />
    </div>
  )
}

const R = (s: 'live' | 'loading' | 'empty' | 'error' | 'stale') => () => mockRegulatorReports(s)
const C = (s: 'live' | 'loading' | 'empty' | 'error' | 'stale') => () => mockControllerRegister(s)

const VIEWS: Record<string, { chrome: 'reg' | 'proof'; node: () => ReactNode }> = {
  overview: { chrome: 'reg', node: () => <Overview loadReports={R('live')} loadRegister={C('live')} loadBreaches={list('live')} /> },
  'overview-loading': { chrome: 'reg', node: () => <Overview loadReports={R('loading')} loadRegister={C('loading')} loadBreaches={list('loading')} /> },
  'overview-empty': { chrome: 'reg', node: () => <Overview loadReports={R('empty')} loadRegister={C('empty')} loadBreaches={list('empty')} /> },
  'overview-error': { chrome: 'reg', node: () => <Overview loadReports={R('error')} loadRegister={C('error')} loadBreaches={list('error')} /> },
  'reports-arrive': { chrome: 'reg', node: () => <ArrivingReports /> },
  list: { chrome: 'reg', node: () => <BreachList load={list('live')} loadDetail={detail('live')} /> },
  'list-loading': { chrome: 'reg', node: () => <BreachList load={list('loading')} loadDetail={detail('live')} /> },
  'list-empty': { chrome: 'reg', node: () => <BreachList load={list('empty')} loadDetail={detail('live')} /> },
  'list-error': { chrome: 'reg', node: () => <BreachList load={list('error')} loadDetail={detail('live')} /> },
  detail: { chrome: 'reg', node: () => <Narrow><BreachDetailLoader id="brc_01" load={detail('live')} /></Narrow> },
  'detail-late': { chrome: 'reg', node: () => <Narrow><BreachDetailLoader id="brc_02" load={detail('live')} /></Narrow> },
  'detail-notfound': { chrome: 'reg', node: () => <Narrow><BreachDetailLoader id="brc_99" load={detail('notfound')} /></Narrow> },
  watch: { chrome: 'reg', node: () => <ReplayWatch /> },
  'watch-stale': { chrome: 'reg', node: () => <WatchView load={watch('stale')} /> },
  'watch-loading': { chrome: 'reg', node: () => <WatchView load={watch('loading')} /> },
  'watch-empty': { chrome: 'reg', node: () => <WatchView load={watch('empty')} /> },
  'watch-error': { chrome: 'reg', node: () => <WatchView load={watch('error')} /> },
  reports: { chrome: 'reg', node: () => <ReportsQueue load={() => mockRegulatorReports('live')} sign={gallerySign} review={mockReviewReport} /> },
  'reports-loading': { chrome: 'reg', node: () => <ReportsQueue load={() => mockRegulatorReports('loading')} sign={gallerySign} review={mockReviewReport} /> },
  'reports-empty': { chrome: 'reg', node: () => <ReportsQueue load={() => mockRegulatorReports('empty')} sign={gallerySign} review={mockReviewReport} /> },
  'reports-error': { chrome: 'reg', node: () => <ReportsQueue load={() => mockRegulatorReports('error')} sign={gallerySign} review={mockReviewReport} /> },
  'reports-wrong-wallet': { chrome: 'reg', node: () => <ReportsQueue load={() => mockRegulatorReports('live')} sign={strangerSign} review={mockReviewReport} /> },
  controllers: { chrome: 'reg', node: () => <ControllersView load={() => mockControllerRegister('live')} loadReports={R('live')} loadBreaches={list('live')} /> },
  'controllers-loading': { chrome: 'reg', node: () => <ControllersView load={() => mockControllerRegister('loading')} /> },
  'controllers-empty': { chrome: 'reg', node: () => <ControllersView load={() => mockControllerRegister('empty')} /> },
  'controllers-error': { chrome: 'reg', node: () => <ControllersView load={() => mockControllerRegister('error')} /> },
  'controllers-no-watch': { chrome: 'reg', node: () => <ControllersView load={() => mockControllerRegister('stale')} /> },
  proof: { chrome: 'proof', node: () => <ProofHome initialQuery="" /> },
  'proof-fingerprint': { chrome: 'proof', node: () => <ProofHome initialQuery={`0x${'3fa2c41b7e0d'.repeat(5)}5b1e`} /> },
  'proof-match': { chrome: 'proof', node: () => <Shared demo="match" /> },
  'proof-altered': { chrome: 'proof', node: () => <Shared demo="altered" /> },
  'proof-notfound': { chrome: 'proof', node: () => <Shared demo="notfound" /> },
  'proof-missing': { chrome: 'proof', node: () => <NotFoundScreen kind="proof" chrome="embedded" requested="0x9c1e…4b27 · x" /> },
  'proof-incomplete': { chrome: 'proof', node: () => <ProofIncomplete mismatch={false} /> },
  'proof-mismatch': { chrome: 'proof', node: () => <ProofIncomplete mismatch /> },
}

// Gallery signers, no wallet prompt: one signs as the fixture admin, the other shows the wrong-wallet message.
const FIXTURE_ADMIN = '0x4b2e9c0d7a1f3e5b8c6d2a9f0e1b3c5d7a9e2f41'
const SIGNATURE = `0x${'ab'.repeat(65)}` as `0x${string}`
const gallerySign = async () => {
  await new Promise((r) => setTimeout(r, 600))
  return { signature: SIGNATURE, address: FIXTURE_ADMIN }
}
const strangerSign = async () => ({ signature: SIGNATURE, address: '0x9e1d0c2b3a4f5e6d7c8b9a0f1e2d3c4b5a6f7e80' })

function ArrivingReports() {
  const [load] = useState(() => arrivingReports())
  return <ReportsQueue load={load} sign={gallerySign} review={mockReviewReport} pollMs={1000} />
}

const ACTIVE = (view: string): RegNavKey | undefined =>
  view.startsWith('overview') ? 'overview' : view.startsWith('reports') ? 'reports' : view.startsWith('controllers') ? 'agencies' : view.startsWith('watch') ? 'watch' : view.startsWith('list') || view.startsWith('detail') ? 'breach' : undefined

function Narrow({ children }: { children: ReactNode }) {
  return <div className="mx-auto flex max-w-[820px] flex-col gap-6">{children}</div>
}

/** One regulator / proof state in its real chrome, full page, mock data: /dev/states/regulator/frame?view=<id>. */
export function Frame() {
  const view = useSearchParams().get('view') ?? 'watch'
  const v = VIEWS[view]
  if (!v) {
    return (
      <main className="p-10 font-mono text-[14px] text-ink-2">
        Unknown view. Try: {Object.keys(VIEWS).join(', ')}
      </main>
    )
  }
  if (v.chrome === 'proof') return <ProofChrome>{v.node()}</ProofChrome>
  return (
    <RegulatorChrome active={ACTIVE(view)} loadReports={R('live')}>
      {v.node()}
    </RegulatorChrome>
  )
}
