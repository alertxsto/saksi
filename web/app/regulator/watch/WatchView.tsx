'use client'

import { useQuery } from '@tanstack/react-query'
import { useId, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { LiveDot } from '@/components/ui/Chip'
import { DotIcon } from '@/components/ui/DotIcon'
import { IconRefresh } from '@/components/ui/icons'
import { Skeleton } from '@/components/ui/Skeleton'
import { sortWatch, WatchTable } from '@/components/ui/WatchTable'
import { Quiet } from '@/components/regulator/Quiet'
import { RiseHeading } from '@/components/regulator/Rise'
import { Scramble } from '@/components/regulator/Scramble'
import { StackBar } from '@/components/regulator/StackBar'
import { StatRow } from '@/components/regulator/StatRow'
import { WhatChanged } from '@/components/regulator/WhatChanged'
import { getWatchView, type WatchRowView, type WatchView as WatchData } from '@/lib/data'
import { useNow } from '@/lib/hooks'

const POLL_MS = 3000
const FLASH_MS = 10_000

const HOW = [
  { glyph: 'eye', text: 'Read every AccessLogged event from the journal contract.' },
  { glyph: 'shield', text: 'Recompute each database row’s fingerprint.' },
  { glyph: 'cross', text: 'Different fingerprint is ALTERED. A missing row is DELETED. Nothing else is red.' },
] as const

/** Watch (climax): polls every 3 s while the tab is visible; problem rows first, a fresh ALTERED flashes once. */
export function WatchView({ load }: { load?: () => Promise<WatchData> }) {
  const instance = useId()
  const now = useNow()
  const [sel, setSel] = useState<string | null>(null)
  const q = useQuery({
    queryKey: ['watch', load ? instance : 'live'],
    queryFn: () => (load ?? getWatchView)(),
    refetchInterval: POLL_MS,
    // Pauses while the tab is hidden; resumes on return.
    refetchIntervalInBackground: false,
    retry: false,
  })

  const onRetry = () => void q.refetch()
  const onSelectRow = (ref: string) => setSel(ref)

  const rows = sortWatch(q.data?.rows ?? [])
  const count = (s: WatchRowView['status']) => rows.filter((r) => r.status === s).length
  const flashing = rows.find((r) => r.changedAt && now && now - r.changedAt < FLASH_MS)
  const focus = rows.find((r) => r.ref === sel) ?? rows.find((r) => r.status === 'ALTERED') ?? rows.find((r) => r.status !== 'MATCH')
  const hasData = q.data !== undefined
  // Slow or failing RPC after a good answer: keep the last result, gray, never red.
  const stale = hasData && (q.data.stale || q.isError)
  const offline = !hasData && q.isError
  const ageSec = hasData && now ? Math.max(0, Math.round((now - q.dataUpdatedAt) / 1000)) : 0
  const block = q.data ? q.data.blockNumber.toLocaleString('en-US') : null

  return (
    <div className="flex flex-col gap-10 md:gap-12">
      <div className="grid gap-6 lg:grid-cols-12 lg:items-end">
        <RiseHeading
          as="h1"
          lead="The database says one thing."
          tail="The chain remembers."
          className="text-[34px] leading-[1.04] md:text-[56px] lg:col-span-8"
        />
        <p className="max-w-[46ch] text-[16px] leading-[1.6] tracking-[0.01em] text-ink-2 md:text-[17px] lg:col-span-4 lg:col-start-9">
          Saksi re-reads every sealed fingerprint and compares it with the company’s own database. Red means a row was
          changed or removed after it was sealed. Nothing else is red.
        </p>
      </div>

      <p aria-live="polite" className="sr-only">
        {flashing ? `Alert: receipt ${flashing.ref} from ${flashing.controllerName} was altered in the database.` : ''}
      </p>

      <div className="flex flex-col gap-4">
        <StatRow
          label="Receipts by verdict"
          size="xl"
          intro
          stats={[
            { label: 'Match', value: hasData ? count('MATCH') : null, hint: 'Database = chain', tone: 'ok' },
            { label: 'Altered', value: hasData ? count('ALTERED') : null, hint: 'Edited after sealing', tone: 'bad', alarm: true },
            { label: 'Deleted', value: hasData ? count('DELETED') : null, hint: 'Row missing from database', tone: 'bad', alarm: true },
            { label: 'Not anchored', value: hasData ? count('NOT_ANCHORED') : null, hint: 'Never reached the chain', tone: 'pending' },
          ]}
        />
        <StackBar
          label="Receipts by verdict"
          parts={[
            { key: 'm', label: 'match', value: count('MATCH'), className: 'bg-ok' },
            { key: 'a', label: 'altered', value: count('ALTERED'), className: 'bg-bad' },
            { key: 'd', label: 'deleted', value: count('DELETED'), className: 'rg-hatch-bad' },
            { key: 'n', label: 'not anchored', value: count('NOT_ANCHORED'), className: 'bg-pending' },
          ]}
        />
      </div>

      {/* xl: table left (two rows), What changed + How right. Below xl What changed comes first, so the
          verdict is on screen before the table (1024, phones, a projector zoomed in). */}
      <div className="grid gap-8 xl:grid-cols-12 xl:grid-rows-[auto_1fr]">
        <div className="min-w-0 xl:col-span-8 xl:row-span-2">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className="text-[19px] font-medium tracking-[-0.015em] text-ink md:text-[22px]">
              Receipts <span className="text-ink-2">· problems first</span>
            </h2>
            <p className={`label flex items-center gap-2 whitespace-nowrap text-[11px] ${stale || offline ? 'text-unknown' : 'text-ink-2'}`}>
              {stale || offline ? <span aria-hidden="true" className="size-2 rounded-full bg-unknown" /> : <LiveDot tone="ok" ping={hasData} />}
              {stale ? 'Node slow' : offline ? 'No connection' : !hasData ? 'Connecting' : q.isFetching ? 'Checking…' : 'Live · every 3 s'}
            </p>
          </div>
          {stale ? (
            <div role="status" className="mb-4 flex flex-wrap items-center justify-between gap-3 border-y border-line py-3">
              <p className="flex items-start gap-3 text-[14px] text-unknown">
                <DotIcon name="clock" size={16} className="mt-0.5 shrink-0" />
                <span>
                  <strong className="font-medium text-ink">The chain node is slow.</strong> Showing the last check from block {block}
                  {ageSec ? `, ${ageSec} s ago` : ''}. This is not a sign of tampering.
                </span>
              </p>
              <Button variant="light" size="sm" icon={<IconRefresh size={15} />} onClick={onRetry}>
                Check now
              </Button>
            </div>
          ) : null}
          {q.isPending ? (
            <div className="flex flex-col overflow-hidden rounded-lg border border-line bg-card" aria-busy="true" aria-label="Loading receipts">
              {Array.from({ length: 7 }, (_, i) => (
                <div key={i} className="flex items-center gap-6 border-b border-line p-4 last:border-b-0">
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-5 w-28" />
                  <Skeleton className="h-5 flex-1" />
                  <Skeleton className="h-7 w-24" />
                </div>
              ))}
            </div>
          ) : !hasData ? (
            <Quiet
              glyph="eye"
              title="Watch can’t reach the chain node"
              body={`${q.error?.message ?? 'No answer.'} Nothing is shown, so nothing is decided. This is not a sign of tampering.`}
              action={
                <Button variant="light" size="sm" icon={<IconRefresh size={15} />} onClick={onRetry}>
                  Retry now
                </Button>
              }
            />
          ) : rows.length === 0 ? (
            <Quiet
              glyph="eye"
              title="No sealed receipts to watch yet"
              body="Rows appear here as soon as a controller seals its first access record on chain."
            />
          ) : (
            <div className={`transition-[opacity,filter] duration-300 ${stale ? 'opacity-70 grayscale-[35%]' : ''}`}>
              <WatchTable rows={rows} selected={focus?.ref} onSelect={onSelectRow} flashRef={flashing?.ref ?? null} />
            </div>
          )}
          {hasData ? (
            <p className="mt-3 font-mono text-[12px] text-ink-2">
              Last check at block <Scramble value={block ?? '—'} digits intro={false} className="tnum text-ink" />
              {rows.length ? ` · ${rows.length} receipts · chain sealed is the truth, the database is the suspect` : ''}
            </p>
          ) : null}
        </div>

        <div className="order-first xl:order-none xl:col-span-4">
          {q.isPending ? (
            <Skeleton className="h-[340px] w-full rounded-xl" />
          ) : (
            <WhatChanged
              focus={focus}
              known={hasData && rows.length > 0}
              note={
                !hasData
                  ? 'No answer from the chain node yet, so nothing is compared.'
                  : rows.length === 0
                    ? 'Nothing to compare yet.'
                    : 'Every database row matches its sealed fingerprint.'
              }
            />
          )}
        </div>

        <section aria-labelledby="how-watch" className="xl:col-span-4">
          <h3 id="how-watch" className="text-[19px] font-medium tracking-[-0.015em] text-ink">
            How Watch works
          </h3>
          <ul className="mt-3 border-b border-line">
            {HOW.map((h) => (
              <li key={h.glyph} className="flex gap-3 border-t border-line py-3 text-[14px] leading-relaxed text-ink-2">
                <DotIcon name={h.glyph} size={16} className="mt-0.5 shrink-0 text-ink" />
                {h.text}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
