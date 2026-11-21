'use client'

// Projected pitch screen (riset-ui/24 §1). Pure: every value and the state come in through props.
// Sized in "stage units" (--su = 1 px of a 1920×1080 frame, from the nearest .stage-frame container),
// so it scales to any 16:9 projector or gallery frame without scrollbars. CSS: globals.css /* ── STAGE ── */.
import { useEffect, useId, useRef, type CSSProperties } from 'react'
import { IconCheck, IconX } from '@/components/ui/icons'
import { LogoMark } from '@/components/ui/Logo'
import { QrBlock } from '@/components/ui/QrBlock'
import { VaultSealGL } from '@/components/ui/VaultSealGL'
import { scramble } from '@/lib/motion/scramble'
import {
  ageShort,
  eventLabel,
  shortUrl,
  type StageChange,
  type StageCounts,
  type StageFeedRow,
  type StageFeedStatus,
  type StageState,
  type StageWatchCounts,
} from './model'
import { RollNumber } from './RollNumber'

export type StageViewProps = {
  state: StageState
  /** Clock for "8s ago" (ms). 0 before hydration: ages are hidden. */
  now: number
  counts: StageCounts | null
  feed: StageFeedRow[]
  watch: StageWatchCounts | null
  /** First ALTERED Watch row, spelled out under the alert headline. */
  change: StageChange | null
  blockNumber: number | null
  chainName: string
  /** Full QR target, `${SITE_URL}/citizen`. */
  joinUrl: string
  /** When the last good data arrived (ms); shown while offline. */
  updatedAt?: number | null
  /** Gallery: animate rows that are already there on first render. */
  animateInitial?: boolean
}

const d = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties
const CODE_GLYPHS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/** Doto size step so the widest realistic value still fits its third of the column. */
function sizeFor(value: string): string {
  const n = value.replace(/\D/g, '').length
  return n <= 3 ? 'stg-num-xl' : n === 4 ? 'stg-num-lg' : 'stg-num-md'
}

function Scramble({ text, run, alphabet = CODE_GLYPHS }: { text: string; run: boolean; alphabet?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!run || !el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    return scramble(el, text, { alphabet, stepMs: 55, hz: 20, keep: /[•\s·]/ })
  }, [run, text, alphabet])
  return <span ref={ref}>{text}</span>
}

const STATUS: Record<StageFeedStatus, { text: string; cls: string; icon?: 'ok' | 'bad' }> = {
  anchored: { text: 'RECORDED', cls: 'text-ok-v', icon: 'ok' },
  submitted: { text: 'SEALING…', cls: 'text-pending-v' },
  pending: { text: 'SEALING…', cls: 'text-pending-v' },
  failed: { text: 'NOT SEALED', cls: 'text-unknown-v' },
  altered: { text: 'ALTERED', cls: 'text-bad-v', icon: 'bad' },
}

function FeedRow({ row, now, fresh }: { row: StageFeedRow; now: number; fresh: boolean }) {
  const s = STATUS[row.status]
  const age = row.at !== null && now ? `${ageShort(row.at, now)} ago` : ''
  return (
    <li className="stg-row" data-new={fresh ? '' : undefined} data-status={row.status}>
      <span className="stg-row-name truncate">{row.controllerName}</span>
      <span className="stg-row-mono text-vault-ink-2">
        <Scramble text={eventLabel(row.eventType)} run={fresh} alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZ" />
      </span>
      <span className="stg-row-mono text-vault-ink">
        <Scramble text={row.citizenMasked ?? ''} run={fresh} />
      </span>
      <span className="stg-row-mono stg-row-age tnum text-right text-vault-ink-2">{age}</span>
      <span className={`stg-row-mono stg-row-status ${s.cls}`}>
        {s.icon === 'ok' ? <IconCheck width="0.9em" height="0.9em" strokeWidth={2.5} /> : null}
        {s.icon === 'bad' ? <IconX width="0.9em" height="0.9em" strokeWidth={2.5} /> : null}
        {s.text}
      </span>
    </li>
  )
}

function Counter({ label, value, unit }: { label: string; value: string | null; unit?: string }) {
  return (
    <div className="stg-counter">
      <p className="stg-label">{label}</p>
      <p className="stg-counter-value">
        {value === null ? (
          <span className="stg-num-xl stg-roll font-mono text-vault-ink-2">–</span>
        ) : (
          <RollNumber value={value} className={sizeFor(value)} />
        )}
        {unit && value !== null ? <span className="stg-unit">{unit}</span> : null}
      </p>
    </div>
  )
}

export function StageView({
  state,
  now,
  counts,
  feed,
  watch,
  change,
  blockNumber,
  chainName,
  joinUrl,
  updatedAt = null,
  animateInitial = false,
}: StageViewProps) {
  // Rows not seen before slide + scramble in. The first render only marks what is there (unless the gallery asks).
  const seen = useRef<Set<string> | null>(null)
  const prev = seen.current
  const freshIds = new Set(feed.filter((r) => (prev ? !prev.has(r.id) : animateInitial)).map((r) => r.id))
  useEffect(() => {
    seen.current = new Set([...(seen.current ?? []), ...feed.map((r) => r.id)])
  }, [feed])

  const titleId = useId()
  const alert = state === 'alert'
  const offline = state === 'offline'
  const lastAge = counts?.lastSealAt != null && now ? ageShort(counts.lastSealAt, now) : null
  const lastNum = lastAge ? lastAge.slice(0, -1) : null
  const lastUnit = lastAge ? `${lastAge.slice(-1)} ago` : undefined
  const latest = feed.find((r) => r.status !== 'altered')
  const url = shortUrl(joinUrl)
  const slash = url.indexOf('/')

  return (
    <div className="stg vault grain" data-state={state} data-empty={feed.length === 0 ? '' : undefined}>
      <div aria-hidden="true" className="stg-wash" />

      <div className="stg-main">
        {/* left: join */}
        <section className="stg-join" aria-labelledby={titleId}>
          <h1 id={titleId} className="stg-join-title m-line">
            <span style={d(60)}>Scan to become a citizen</span>
          </h1>
          <div className="stg-qr m-in" style={d(160)}>
            <QrBlock value={joinUrl} label={`QR code: open ${url} on your phone`} />
          </div>
          <p className="stg-url m-in" style={d(260)}>
            <span className="stg-url-or">or visit</span>
            <span className="stg-url-host" data-long={url.length > 24 ? '' : undefined}>
              {slash > 0 ? (
                <>
                  {url.slice(0, slash)}
                  <span className="stg-accent">{url.slice(slash)}</span>
                </>
              ) : (
                url
              )}
            </span>
          </p>
        </section>

        {/* right: counters / alert, feed, watch */}
        <section className="stg-live" aria-label="Live activity">
          <div className="stg-top m-in" style={d(200)}>
            <div className="stg-counters" aria-hidden={alert}>
              <Counter label="Citizens joined" value={counts ? counts.citizens.toLocaleString('en-US') : null} />
              <Counter label="Receipts sealed" value={counts ? counts.receipts.toLocaleString('en-US') : null} />
              <Counter label="Last seal" value={counts ? lastNum : null} unit={lastUnit} />
            </div>
            <div className="stg-alert" role={alert ? 'alert' : undefined} aria-hidden={!alert}>
              <p className="stg-alert-title">A record was changed after sealing</p>
              {change ? (
                <p className="stg-alert-sub">
                  {change.field}: database says <span className="stg-strike">{change.db}</span>, chain sealed{' '}
                  <span className="text-vault-ink">{change.chain}</span>
                </p>
              ) : null}
            </div>
          </div>

          <div className="stg-feed">
            <div aria-hidden="true" className="stg-seal">
              <VaultSealGL verdict={alert ? 'altered' : 'idle'} overlay={false} interactive={false} />
            </div>
            <div className="stg-idle" aria-hidden={!(state === 'idle' || (offline && feed.length === 0))}>
              {offline ? (
                <>
                  <p className="stg-idle-title">Reconnecting to Saksi…</p>
                  <p className="stg-idle-body">The screen picks up again on its own. The QR code still works.</p>
                </>
              ) : (
                <>
                  <p className="stg-idle-title">Waiting for the first receipt</p>
                  <p className="stg-idle-body">
                    Scan the code to become a citizen. When the demo company opens your data, the receipt lands here, sealed on
                    the chain.
                  </p>
                </>
              )}
            </div>
            <ol className="stg-rows" aria-label="Latest receipts">
              {feed.map((r) => (
                <FeedRow key={r.id} row={r} now={now} fresh={freshIds.has(r.id)} />
              ))}
            </ol>
            <p className="sr-only" aria-live="polite">
              {latest ? `New receipt: ${latest.controllerName} ${eventLabel(latest.eventType)}, ${STATUS[latest.status].text}` : ''}
            </p>
          </div>

          <div className="stg-watch m-in" style={d(320)} aria-label="Watch: chain compared with the database">
            {(
              [
                ['MATCH', watch?.match, 'ok'],
                ['ALTERED', watch?.altered, 'bad'],
                ['DELETED', watch?.deleted, 'bad'],
              ] as const
            ).map(([label, n, tone]) => (
              <div key={label} className="stg-watch-item" data-tone={n ? tone : 'zero'}>
                {n === undefined ? (
                  <span className="stg-watch-num stg-roll font-mono">–</span>
                ) : (
                  <RollNumber value={String(n)} className="stg-watch-num" />
                )}
                <span className="stg-watch-label">{label}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <footer className="stg-foot m-in" style={d(380)}>
        <p className="stg-brand">
          <span className="stg-logo">
            <LogoMark tone="vault" />
          </span>
          <span className="stg-brand-name">saksi</span>
          <span className="stg-brand-line">a witness for your personal data</span>
        </p>
        {offline ? (
          <p className="stg-foot-status">
            <span aria-hidden="true" className="stg-dot stg-dot-wait" />
            <span>
              Reconnecting…
              {updatedAt && now ? <span className="text-vault-ink-2"> · last update {ageShort(updatedAt, now)} ago</span> : null}
            </span>
          </p>
        ) : (
          <p className="stg-foot-status">
            <span aria-hidden="true" className="stg-dot" />
            <span>
              <span className="text-vault-ink-2">Sealed on </span>
              {chainName}
              {blockNumber !== null ? (
                <>
                  <span className="text-vault-ink-2"> · Block </span>
                  <RollNumber value={blockNumber.toLocaleString('en-US')} dot={false} className="stg-accent" />
                </>
              ) : null}
            </span>
          </p>
        )}
      </footer>
    </div>
  )
}
