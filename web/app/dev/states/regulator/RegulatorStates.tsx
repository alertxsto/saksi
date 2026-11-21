'use client'

import { useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { TwoTone } from '@/components/ui/Chip'
import { IconRefresh } from '@/components/ui/icons'
import { Logo } from '@/components/ui/Logo'
import { VerifyRunning } from '@/components/ui/VerifyResult'
import { BreachDetailLoader } from '../../../regulator/BreachDetail'
import { BreachList } from '../../../regulator/BreachList'
import { WatchView } from '../../../regulator/watch/WatchView'
import { ProofIncomplete } from '../../../proof/[tx]/[logIndex]/ProofLink'
import { ProofHome } from '../../../proof/ProofHome'
import { ProofResult } from '../../../proof/ProofResult'
import { NotFoundScreen } from '@/components/system/NotFoundScreen'
import { detail, list, PROOF_PATH, replayWatch, SAMPLE, verify, watch } from './loaders'

const FRAME = '/dev/states/regulator/frame?view='
const FRAME_VIEWS = ['list', 'list-loading', 'list-empty', 'list-error', 'detail', 'detail-late', 'detail-notfound', 'watch', 'watch-stale', 'watch-loading', 'watch-empty', 'watch-error', 'proof', 'proof-fingerprint', 'proof-match', 'proof-altered', 'proof-notfound', 'proof-missing', 'proof-incomplete', 'proof-mismatch']

/** The climax on demand: R.0412 flips MATCH → ALTERED 4.5 s after mount; Replay remounts it. */
function ReplayWatch() {
  const [run, setRun] = useState(0)
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button variant="light" size="sm" icon={<IconRefresh size={15} />} onClick={() => setRun((r) => r + 1)}>
          Replay the tamper
        </Button>
      </div>
      <ReplayRun key={run} />
    </div>
  )
}
function ReplayRun() {
  const [load] = useState(() => replayWatch())
  return <WatchView load={load} />
}

const SECTIONS = [
  { id: 'list', label: 'Breach list' },
  { id: 'detail', label: 'Breach detail' },
  { id: 'watch', label: 'Watch' },
  { id: 'proof', label: '/proof' },
  { id: 'proof-390', label: '/proof · 390' },
  { id: 'frames', label: 'Full-page frames' },
]

/** One state, framed with its name and the URL that reproduces it. */
function State({ name, url, children }: { name: string; url?: string; children: ReactNode }) {
  return (
    <figure className="flex flex-col gap-3">
      <figcaption className="flex items-baseline justify-between gap-4 border-b border-line pb-2">
        <span className="label text-ink">{name}</span>
        {url ? <code className="truncate font-mono text-[12px] text-blue">{url}</code> : null}
      </figcaption>
      <div className="rounded-xl border border-dashed border-line-strong bg-paper p-6">{children}</div>
    </figure>
  )
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="flex scroll-mt-6 flex-col gap-10">
      <h2 id={`${id}-h`} className="text-[28px] font-medium tracking-[-0.03em] text-ink">
        {title}
      </h2>
      {children}
    </section>
  )
}

function Running() {
  const [startedAt] = useState(() => Date.now())
  return <VerifyRunning startedAt={startedAt} />
}

function Phone({ name, src }: { name: string; src: string }) {
  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="label text-[11px] text-ink">{name}</figcaption>
      <iframe title={name} src={src} width={390} height={844} className="rounded-xl border border-line-strong bg-paper" />
    </figure>
  )
}

/** Every state of /regulator, /regulator/breach/[id], /regulator/watch and /proof, on one page (mock data). */
export function RegulatorStates() {
  return (
    <main id="main" className="mx-auto flex max-w-[1280px] flex-col gap-20 px-6 py-10">
      <header className="flex flex-col gap-4">
        <Logo sub="Dev · states" />
        <TwoTone head="Regulator & /proof." tail="Every state." className="text-[40px]" />
        <nav aria-label="Sections" className="flex flex-wrap gap-2">
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="label rounded-pill border border-line bg-card px-3 py-2 text-ink hover:border-ink hover:text-blue"
            >
              {s.label}
            </a>
          ))}
        </nav>
      </header>

      <Section id="list" title="Breach list">
        <State name="Loaded · total / on time / late + badges" url="/regulator">
          <BreachList load={list('live')} loadDetail={detail('live')} />
        </State>
        <State name="Loading" url="/regulator?state=loading">
          <BreachList load={list('loading')} loadDetail={detail('live')} />
        </State>
        <State name="Empty" url="/regulator?state=empty">
          <BreachList load={list('empty')} loadDetail={detail('live')} />
        </State>
        <State name="Error" url="/regulator?state=error">
          <BreachList load={list('error')} loadDetail={detail('live')} />
        </State>
      </Section>

      <Section id="detail" title="Breach detail">
        <State name="On time" url="/regulator/breach/brc_01">
          <div className="mx-auto max-w-[820px]">
            <BreachDetailLoader id="brc_01" load={detail('live')} />
          </div>
        </State>
        <State name="Late · overrun past 72 H in red" url="/regulator/breach/brc_02">
          <div className="mx-auto max-w-[820px]">
            <BreachDetailLoader id="brc_02" load={detail('live')} />
          </div>
        </State>
        <State name="Loading" url="/regulator/breach/brc_01?state=loading">
          <div className="mx-auto max-w-[820px]">
            <BreachDetailLoader id="brc_01" load={detail('loading')} />
          </div>
        </State>
        <State name="Not found" url="/regulator/breach/brc_99">
          <div className="mx-auto max-w-[820px]">
            <BreachDetailLoader id="brc_01" load={detail('notfound')} />
          </div>
        </State>
        <State name="Error" url="/regulator/breach/brc_01?state=error">
          <div className="mx-auto max-w-[820px]">
            <BreachDetailLoader id="brc_01" load={detail('error')} />
          </div>
        </State>
      </Section>

      <Section id="watch" title="Watch">
        <State name="Live · replay: R.0412 flips to ALTERED 4.5 s after mount (flash, rises to top, counter rolls, stamp)" url={`${FRAME}watch`}>
          <ReplayWatch />
        </State>
        <State name="Live · already ALTERED (settled)" url="/regulator/watch">
          <WatchView load={watch('live')} />
        </State>
        <State name="Stale · RPC slow (gray, never red)" url="/regulator/watch?state=stale">
          <WatchView load={watch('stale')} />
        </State>
        <State name="Loading" url="/regulator/watch?state=loading">
          <WatchView load={watch('loading')} />
        </State>
        <State name="Empty" url="/regulator/watch?state=empty">
          <WatchView load={watch('empty')} />
        </State>
        <State name="Error · no connection" url="/regulator/watch?state=error">
          <WatchView load={watch('error')} />
        </State>
      </Section>

      <Section id="proof" title="/proof">
        <State name="Input · fingerprint or tx, Scan QR, Upload receipt JSON" url="/proof">
          <ProofHome initialQuery="" />
        </State>
        <State name="Lookup · not found on this node (gray)" url="/proof?q=0x00…">
          <ProofHome initialQuery="0x0000000000000000000000000000000000000000000000000000000000000000" />
        </State>
        <State name="Verifying" url={`${PROOF_PATH}#…`}>
          <div className="max-w-[640px]">
            <Running />
          </div>
        </State>
        <State name="Result · MATCH" url={`${PROOF_PATH}#…`}>
          <ProofResult opening={SAMPLE} verify={verify('match')} autoStart />
        </State>
        <State name="Result · ALTERED" url={`${PROOF_PATH}?demo=altered#…`}>
          <ProofResult opening={SAMPLE} verify={verify('altered')} autoStart />
        </State>
        <State name="Result · NOT FOUND (gray)" url={`${PROOF_PATH}?demo=notfound#…`}>
          <ProofResult opening={SAMPLE} verify={verify('notfound')} autoStart />
        </State>
        <State name="Link incomplete · damaged #fragment" url={`${PROOF_PATH}#<truncated>`}>
          <ProofIncomplete mismatch={false} />
        </State>
        <State name="Link incomplete · receipt names another tx" url={`${PROOF_PATH}#<other receipt>`}>
          <ProofIncomplete mismatch />
        </State>
        <State name="Missing proof · address names no record (shared 404)" url="/proof/0xnot-a-tx/x">
          <NotFoundScreen kind="proof" chrome="embedded" requested="0xnot-a-tx · x" />
        </State>
      </Section>

      <Section id="proof-390" title="/proof · 390 px">
        <div className="flex flex-wrap gap-6">
          <Phone name="Input" src={`${FRAME}proof`} />
          <Phone name="Fingerprint only (gray)" src={`${FRAME}proof-fingerprint`} />
          <Phone name="MATCH" src={`${FRAME}proof-match`} />
          <Phone name="ALTERED" src={`${FRAME}proof-altered`} />
          <Phone name="NOT FOUND" src={`${FRAME}proof-notfound`} />
          <Phone name="Link incomplete" src={`${FRAME}proof-incomplete`} />
        </div>
      </Section>

      <Section id="frames" title="Full-page frames (real chrome, mock data)">
        <ul className="grid grid-cols-2 gap-x-6 border-t border-line md:grid-cols-4">
          {FRAME_VIEWS.map((v) => (
            <li key={v} className="border-b border-line">
              <a href={`${FRAME}${v}`} className="flex min-h-11 items-center font-mono text-[13px] text-blue hover:underline">
                {v}
              </a>
            </li>
          ))}
        </ul>
      </Section>
    </main>
  )
}
