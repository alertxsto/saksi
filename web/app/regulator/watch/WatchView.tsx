'use client'

import { useQuery } from '@tanstack/react-query'
import { useId, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { DotIcon } from '@/components/ui/DotIcon'
import { IconArrow, IconArrowUpRight, IconCheck, IconEye, IconMinus, IconRefresh, IconX } from '@/components/ui/icons'
import { Skeleton } from '@/components/ui/Skeleton'
import { sortWatch } from '@/components/ui/WatchTable'
import { fieldLabel, humanValue } from '@/components/regulator/labels'
import { Sheet } from '@/components/regulator/Sheet'
import { Calm, Kpi, PageHeader, plainTime, ProofRow, TechnicalProof } from '@/components/regulator/Workspace'
import { explorerLink, getWatchView, type WatchRowView, type WatchView as WatchData } from '@/lib/data'
import { useNow } from '@/lib/hooks'
import '../regulator.css'

const POLL_MS = 3000
const FLASH_MS = 10_000

const HOW = [
  { glyph: 'eye', text: 'Read every access sealed on the public ledger by the journal contract.' },
  { glyph: 'shield', text: 'Recompute the fingerprint of each row in the agency’s database.' },
  { glyph: 'cross', text: 'A different fingerprint means changed after sealing. A missing row means deleted by the agency. Nothing else is red.' },
] as const

const VERDICT: Record<WatchRowView['status'], { label: string; tone: 'ok' | 'bad' | 'pending' }> = {
  MATCH: { label: 'Matches the sealed record', tone: 'ok' },
  ALTERED: { label: 'Changed after sealing', tone: 'bad' },
  DELETED: { label: 'Deleted by the agency', tone: 'bad' },
  NOT_ANCHORED: { label: 'Not sealed yet', tone: 'pending' },
}
const short = (name: string) => name.replace(' (fictional)', '').replace(' (fiktif)', '')
const fieldOf = (r: WatchRowView) => (r.field && r.field !== 'row' && r.field !== 'txHash' ? fieldLabel(r.field) : null)

function Verdict({ r }: { r: WatchRowView }) {
  const v = VERDICT[r.status]
  if (v.tone === 'ok')
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] font-medium text-ok">
        <IconCheck size={13} strokeWidth={2.6} /> Matches
      </span>
    )
  return (
    <span
      className={`inline-flex h-7 items-center gap-1 whitespace-nowrap rounded-pill border px-2.5 text-[13px] font-medium ${
        v.tone === 'bad' ? 'border-bad/25 bg-bad-bg text-bad' : 'border-pending/25 bg-pending-bg text-pending'
      }`}
    >
      {r.status === 'ALTERED' ? <IconX size={12} strokeWidth={2.8} /> : <IconMinus size={12} strokeWidth={2.8} />}
      {v.label}
    </span>
  )
}

/** The database's word against the sealed record, for one receipt. */
function Compare({ r }: { r: WatchRowView }) {
  const f = fieldOf(r)
  const bad = r.status === 'ALTERED' || r.status === 'DELETED'
  if (r.status === 'MATCH') return <p className="text-[14px] text-ink-2">The database row has the same fingerprint as the sealed record.</p>
  return (
    <dl className="flex flex-col gap-2">
      {f ? <p className="text-[13px] text-ink-3">Field · {f}</p> : null}
      <div className={`rounded-md px-3.5 py-3 ${bad ? 'bg-bad-bg/70' : 'bg-pending-bg/70'}`}>
        <dt className={`flex items-center gap-1.5 text-[13px] font-medium ${bad ? 'text-bad' : 'text-pending'}`}>
          <IconX size={12} strokeWidth={2.8} /> The database says
        </dt>
        <dd className="mt-1 break-words text-[15px] text-ink">
          {r.status === 'DELETED' ? 'Nothing. The row is gone.' : r.dbValue ? humanValue(r.dbValue) : '—'}
        </dd>
      </div>
      <div className="rounded-md bg-paper-2/70 px-3.5 py-3">
        <dt className="flex items-center gap-1.5 text-[13px] font-medium text-ok">
          <IconCheck size={12} strokeWidth={2.8} /> The sealed record says
        </dt>
        <dd className="mt-1 break-words text-[15px] text-ink">{r.chainValue && r.chainValue !== '—' ? humanValue(r.chainValue) : 'Nothing sealed yet'}</dd>
      </div>
    </dl>
  )
}

function RowDetail({ r }: { r: WatchRowView }) {
  const v = VERDICT[r.status]
  return (
    <div className="rg2-swap flex flex-col gap-4">
      <div>
        <p className="font-mono text-[13px] text-ink-3">Receipt {r.ref}</p>
        <p className="mt-1 text-[18px] font-semibold tracking-[-0.015em] text-ink">{short(r.controllerName)}</p>
        <p className={`mt-1 text-[14px] font-medium ${v.tone === 'bad' ? 'text-bad' : v.tone === 'pending' ? 'text-pending' : 'text-ok'}`}>{v.label}</p>
        {r.changedAt ? <p className="mt-0.5 text-[13px] text-ink-3">Found by Watch · {plainTime(r.changedAt)}</p> : null}
      </div>
      <Compare r={r} />
      <p className="text-[13px] leading-relaxed text-ink-3">UU PDP Pasal 32: this is the processing record a citizen may ask the agency for.</p>
      <TechnicalProof>
        <ProofRow k="Transaction">
          <a href={explorerLink('tx', r.txHash)} target="_blank" rel="noreferrer" className="inline-flex min-h-8 items-center gap-1 hover:text-blue">
            {r.txHash.slice(0, 10)}…{r.txHash.slice(-6)} <IconArrowUpRight size={12} />
          </a>
        </ProofRow>
        <ProofRow k="Log index">{r.logIndex}</ProofRow>
        {r.blockNumber ? <ProofRow k="Block">{r.blockNumber.toLocaleString('en-US')}</ProofRow> : null}
      </TechnicalProof>
    </div>
  )
}

/**
 * Watch: the agency's database reconciled against the sealed record. Re-checks every 3 s while the tab is
 * visible (quietly: no ticker). Problem rows first; red only for a record changed or deleted after sealing.
 */
export function WatchView({ load }: { load?: () => Promise<WatchData> }) {
  const instance = useId()
  const now = useNow()
  const [sel, setSel] = useState<string | null>(null)
  const [sheet, setSheet] = useState(false)
  const q = useQuery({
    queryKey: ['watch', load ? instance : 'live'],
    queryFn: () => (load ?? getWatchView)(),
    refetchInterval: POLL_MS,
    // Pauses while the tab is hidden; resumes on return.
    refetchIntervalInBackground: false,
    retry: false,
  })

  const onRetry = () => void q.refetch()
  const onSelectRow = (ref: string) => {
    setSel(ref)
    if (window.matchMedia('(max-width: 1023px)').matches) setSheet(true)
  }

  const rows = sortWatch(q.data?.rows ?? [])
  const count = (s: WatchRowView['status']) => rows.filter((r) => r.status === s).length
  const flashing = rows.find((r) => r.changedAt && now && now - r.changedAt < FLASH_MS)
  const focus = rows.find((r) => r.ref === sel) ?? rows.find((r) => r.status === 'ALTERED') ?? rows.find((r) => r.status !== 'MATCH') ?? rows[0]
  const last = useRef<WatchRowView | undefined>(undefined)
  if (focus) last.current = focus
  const hasData = q.data !== undefined
  // Slow or failing RPC after a good answer: keep the last result, gray, never red.
  const stale = hasData && (q.data.stale || q.isError)
  const ageSec = hasData && now ? Math.max(0, Math.round((now - q.dataUpdatedAt) / 1000)) : 0

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <PageHeader
        title="Watch"
        desc={
          <>
            Saksi re-reads every sealed fingerprint and compares it with the agency’s access record, the processing record a citizen may
            ask for under UU PDP Pasal 32. Red means a row was changed or removed after it was sealed. Nothing else is red.
          </>
        }
      />

      <p aria-live="polite" className="sr-only">
        {flashing ? `Alert: receipt ${flashing.ref} from ${flashing.controllerName} was changed in the database after sealing.` : ''}
      </p>

      {!hasData && q.isError ? (
        <Calm
          icon={<IconEye size={18} />}
          title="Watch can’t reach the public ledger"
          body={`${q.error?.message ?? 'No answer.'} Nothing is shown, so nothing is decided. This is not a sign of tampering.`}
          action={
            <Button variant="light" size="sm" icon={<IconRefresh size={15} />} onClick={onRetry}>
              Try again
            </Button>
          }
        />
      ) : (
        <>
          <section aria-label="Receipts by verdict" className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            <Kpi label="Matches the sealed record" value={hasData ? count('MATCH') : null} hint="Database = public ledger" />
            <Kpi label="Changed after sealing" value={hasData ? count('ALTERED') : null} tone={count('ALTERED') ? 'bad' : 'ink'} hint="Edited in the database" />
            <Kpi label="Deleted by the agency" value={hasData ? count('DELETED') : null} tone={count('DELETED') ? 'bad' : 'ink'} hint="Row missing, still sealed" />
            <Kpi label="Not sealed yet" value={hasData ? count('NOT_ANCHORED') : null} tone={count('NOT_ANCHORED') ? 'pending' : 'ink'} hint="Never reached the ledger" />
          </section>

          {stale ? (
            <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-paper-2/60 px-4 py-3">
              <p className="flex items-start gap-3 text-[14px] text-ink-2">
                <DotIcon name="clock" size={16} className="mt-0.5 shrink-0" />
                <span>
                  <strong className="font-medium text-ink">The ledger node is slow.</strong> Showing the last check{ageSec ? `, ${ageSec} s ago` : ''}. This is not a
                  sign of tampering.
                </span>
              </p>
              <Button variant="light" size="sm" icon={<IconRefresh size={15} />} onClick={onRetry}>
                Check now
              </Button>
            </div>
          ) : null}

          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px] xl:gap-8">
            <section aria-labelledby="rec-h" className="flex min-w-0 flex-col gap-3">
              <div className="flex items-baseline justify-between gap-3">
                <h2 id="rec-h" className="text-[15px] font-semibold text-ink">
                  Reconciliation <span className="font-normal text-ink-3">· problems first</span>
                </h2>
                {hasData ? <span className="text-[13px] text-ink-3">{stale ? 'Last check kept' : q.isFetching ? 'Checking…' : 'Checked just now'}</span> : null}
              </div>
              {q.isPending ? (
                <div className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-card" aria-busy="true" aria-label="Loading receipts">
                  {Array.from({ length: 6 }, (_, i) => (
                    <div key={i} className="flex items-center gap-5 px-5 py-4">
                      <Skeleton className="h-4 w-14" />
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-4 flex-1" />
                      <Skeleton className="h-7 w-24 rounded-pill" />
                    </div>
                  ))}
                </div>
              ) : rows.length === 0 ? (
                <Calm icon={<IconEye size={18} />} title="No sealed receipts to watch yet" body="Rows appear here as soon as an agency seals its first access record on the public ledger." />
              ) : (
                <div className={`overflow-hidden rounded-lg border border-line bg-card transition-[opacity,filter] duration-300 ${stale ? 'opacity-70 grayscale-[35%]' : ''}`}>
                  <div className="hidden grid-cols-[72px_minmax(0,1fr)_minmax(0,1.4fr)_auto] gap-4 border-b border-line px-5 py-3 text-[13px] text-ink-3 md:grid" aria-hidden="true">
                    <span>Receipt</span>
                    <span>Agency</span>
                    <span>Database vs sealed record</span>
                    <span className="w-[200px]">Verdict</span>
                  </div>
                  <ul aria-label="Receipts compared: database versus sealed record" className="divide-y divide-line">
                    {rows.map((r) => {
                      const bad = r.status === 'ALTERED' || r.status === 'DELETED'
                      const f = fieldOf(r)
                      const cur = focus?.ref === r.ref
                      const said =
                        r.status === 'MATCH'
                          ? 'Same as sealed'
                          : r.status === 'DELETED'
                            ? 'Row deleted · still sealed'
                            : r.status === 'NOT_ANCHORED'
                              ? 'Not on the ledger yet'
                              : `${f ? `${f}: ` : ''}${r.dbValue ? humanValue(r.dbValue) : '—'} → sealed ${r.chainValue ? humanValue(r.chainValue) : '—'}`
                      return (
                        <li key={r.ref} className={flashing?.ref === r.ref ? 'rg2-new-bad' : ''}>
                          <button
                            type="button"
                            onClick={() => onSelectRow(r.ref)}
                            aria-current={cur ? 'true' : undefined}
                            className={`rg2-entry relative w-full px-4 py-3 text-left md:grid md:grid-cols-[72px_minmax(0,1fr)_minmax(0,1.4fr)_auto] md:items-center md:gap-4 md:px-5 ${bad ? 'rg2-entry-bad' : ''}`}
                          >
                            <span className="tnum hidden font-mono text-[13px] font-semibold text-ink md:block">{r.ref}</span>
                            <span className="flex items-start justify-between gap-3 md:block">
                              <span className="flex min-w-0 flex-col">
                                <span className="truncate text-[15px] font-medium text-ink">
                                  <span className="tnum font-mono text-[13px] text-ink-3 md:hidden">{r.ref} · </span>
                                  {short(r.controllerName)}
                                </span>
                                <span className={`text-[13px] md:hidden ${bad ? 'text-bad' : 'text-ink-3'}`}>{said}</span>
                              </span>
                              <span className="shrink-0 md:hidden">
                                <Verdict r={r} />
                              </span>
                            </span>
                            <span className={`hidden truncate text-[14px] md:block ${bad ? 'font-medium text-bad' : r.status === 'NOT_ANCHORED' ? 'text-pending' : 'text-ink-3'}`}>{said}</span>
                            <span className="hidden w-[200px] items-center justify-between gap-2 md:flex">
                              <Verdict r={r} />
                              <IconArrow size={13} className="text-ink-3" />
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}
            </section>

            <aside className="hidden flex-col gap-6 xl:flex">
              <section aria-label="Selected receipt" className="rounded-lg border border-line bg-card p-5">
                {q.isPending ? <Skeleton className="h-56 w-full" /> : focus ? <RowDetail key={`${focus.ref}-${focus.status}`} r={focus} /> : <p className="text-[14px] text-ink-2">Nothing to compare yet.</p>}
              </section>
              <HowWatch />
            </aside>
          </div>
          <div className="xl:hidden">
            <HowWatch />
          </div>
        </>
      )}

      <Sheet open={sheet && !!focus} onClose={() => setSheet(false)} title={last.current ? `Receipt ${last.current.ref}` : 'Receipt'} desktop={false}>
        {last.current ? <RowDetail r={last.current} /> : null}
      </Sheet>
    </div>
  )
}

function HowWatch() {
  return (
    <section aria-labelledby="how-watch">
      <h3 id="how-watch" className="text-[15px] font-semibold text-ink">
        How Watch works
      </h3>
      <ul className="mt-2 border-b border-line">
        {HOW.map((h) => (
          <li key={h.glyph} className="flex gap-3 border-t border-line py-3 text-[14px] leading-relaxed text-ink-2">
            <DotIcon name={h.glyph} size={16} className="mt-0.5 shrink-0 text-ink" />
            {h.text}
          </li>
        ))}
      </ul>
    </section>
  )
}
