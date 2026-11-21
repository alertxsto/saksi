'use client'

import { useSearchParams } from 'next/navigation'
import { useState, type ReactNode } from 'react'
import { ProofChrome, RegulatorChrome } from '@/components/regulator/Chrome'
import { BreachDetailLoader } from '../../../../regulator/BreachDetail'
import { BreachList } from '../../../../regulator/BreachList'
import { WatchView } from '../../../../regulator/watch/WatchView'
import { ProofIncomplete } from '../../../../proof/[tx]/[logIndex]/ProofLink'
import { ProofHome } from '../../../../proof/ProofHome'
import { ProofResult } from '../../../../proof/ProofResult'
import { RiseHeading } from '@/components/regulator/Rise'
import { NotFoundScreen } from '@/components/system/NotFoundScreen'
import { detail, list, replayWatch, SAMPLE, verify, watch } from '../loaders'

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

const VIEWS: Record<string, { chrome: 'reg' | 'proof'; node: () => ReactNode }> = {
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
  proof: { chrome: 'proof', node: () => <ProofHome initialQuery="" /> },
  'proof-fingerprint': { chrome: 'proof', node: () => <ProofHome initialQuery={`0x${'3fa2c41b7e0d'.repeat(5)}5b1e`} /> },
  'proof-match': { chrome: 'proof', node: () => <Shared demo="match" /> },
  'proof-altered': { chrome: 'proof', node: () => <Shared demo="altered" /> },
  'proof-notfound': { chrome: 'proof', node: () => <Shared demo="notfound" /> },
  'proof-missing': { chrome: 'proof', node: () => <NotFoundScreen kind="proof" chrome="embedded" requested="0x9c1e…4b27 · x" /> },
  'proof-incomplete': { chrome: 'proof', node: () => <ProofIncomplete mismatch={false} /> },
  'proof-mismatch': { chrome: 'proof', node: () => <ProofIncomplete mismatch /> },
}

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
  const Chrome = v.chrome === 'reg' ? RegulatorChrome : ProofChrome
  return <Chrome>{v.node()}</Chrome>
}
