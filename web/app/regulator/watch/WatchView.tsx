'use client'

import { useQuery } from '@tanstack/react-query'
import { useId, useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { LiveDot, TwoTone } from '@/components/ui/Chip'
import { DotIcon } from '@/components/ui/DotIcon'
import { EmptyState } from '@/components/ui/EmptyState'
import { FingerprintChip } from '@/components/ui/FingerprintChip'
import { IconAlert, IconArrowUpRight, IconClock, IconRefresh } from '@/components/ui/icons'
import { KpiTile } from '@/components/ui/KpiTile'
import { RegMarks } from '@/components/ui/RegMarks'
import { Skeleton } from '@/components/ui/Skeleton'
import { VaultSeal } from '@/components/ui/VaultSeal'
import { sortWatch, WatchTable } from '@/components/ui/WatchTable'
import { explorerLink, getWatchView, type WatchRowView, type WatchView as WatchData } from '@/lib/data'
import { useNow } from '@/lib/hooks'

const POLL_MS = 3000
const FLASH_MS = 10_000

const FIELD_LABEL: Record<string, string> = {
  eventType: 'What they did',
  purpose: 'Why',
  legalBasis: 'Legal basis',
  evidence: 'Evidence',
  pseudonym: 'Citizen pseudonym',
  row: 'Whole row',
  txHash: 'Chain transaction',
}

function WhatChanged({ focus, note, known }: { focus: WatchRowView | undefined; note: string; known: boolean }) {
  const bad = focus?.status === 'ALTERED' || focus?.status === 'DELETED'
  return (
    <section className="vault grain relative rounded-xl border border-vault-line bg-vault text-vault-ink" aria-label="What changed">
      <RegMarks className={bad ? 'bg-bad-v' : 'bg-ice'} />
      <div className="relative z-[1] flex items-center gap-4 border-b border-vault-line p-4">
        <div className="w-[84px] shrink-0">
          <VaultSeal tone={bad ? 'bad' : focus && focus.status === 'MATCH' ? 'ok' : focus ? 'unknown' : 'idle'} grid={false} boost={1.45} />
        </div>
        <div>
          <p className="label text-[11px] text-vault-ink-2">What changed</p>
          <p className="tnum mt-1 font-mono text-[22px] font-bold text-vault-ink">{focus?.ref ?? (known ? 'Nothing' : '—')}</p>
          {focus ? <Badge kind={focus.status} onVault size="sm" className="mt-2" /> : null}
        </div>
      </div>
      <div className="relative z-[1] p-4">
        {focus && focus.status !== 'MATCH' ? (
          <>
            <p className="text-[14px] text-vault-ink-2">{focus.controllerName}</p>
            <dl className="mt-3 flex flex-col gap-px overflow-hidden rounded-lg bg-vault-line">
              <div className="flex items-baseline justify-between gap-3 bg-vault-2 p-3">
                <dt className="label text-[11px] text-vault-ink-2">Field</dt>
                <dd className="font-mono text-[13px] text-vault-ink">{FIELD_LABEL[focus.field ?? ''] ?? focus.field ?? '—'}</dd>
              </div>
              <div className="bg-vault-2 p-3">
                <dt className="label text-[11px] text-bad-v">− Database says</dt>
                <dd className="mt-1 font-mono text-[14px] text-vault-ink">{focus.dbValue ?? '—'}</dd>
              </div>
              <div className="bg-vault-2 p-3">
                <dt className="label text-[11px] text-ok-v">+ Chain sealed</dt>
                <dd className="mt-1 font-mono text-[14px] text-vault-ink">{focus.chainValue ?? '—'}</dd>
              </div>
            </dl>
            <div className="mt-3 flex items-center justify-between gap-2">
              <span className="label text-[11px] text-vault-ink-2">Sealed tx</span>
              <span className="flex items-center">
                <FingerprintChip value={focus.txHash} kind="none" onVault label="sealed transaction" />
                <a
                  href={explorerLink('tx', focus.txHash)}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Open sealed transaction on the explorer (new tab)"
                  className="-my-2.5 -mr-2.5 flex h-11 w-11 items-center justify-center rounded-sm text-vault-ink-2 transition-colors hover:bg-vault-2 hover:text-ice"
                >
                  <IconArrowUpRight size={15} />
                </a>
              </span>
            </div>
          </>
        ) : (
          <p className="text-[14px] leading-relaxed text-vault-ink-2">
            {focus ? 'This row matches its sealed fingerprint.' : note}
          </p>
        )}
      </div>
    </section>
  )
}

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
  const altered = count('ALTERED')
  const hasData = q.data !== undefined
  // Slow or failing RPC after a good answer: keep the last result, gray, never red.
  const stale = hasData && (q.data.stale || q.isError)
  const ageSec = hasData && now ? Math.max(0, Math.round((now - q.dataUpdatedAt) / 1000)) : 0
  const block = q.data ? q.data.blockNumber.toLocaleString('en-US') : '—'

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <TwoTone head="The database says one thing." tail="The chain remembers." className="text-[34px] md:text-[48px]" />
        </div>
        <p
          className={`label inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-pill border px-3 ${
            stale || (!hasData && q.isError) ? 'border-unknown/30 bg-unknown-bg text-unknown' : 'border-line bg-card text-ink'
          }`}
        >
          {stale || (!hasData && q.isError) ? (
            <span aria-hidden="true" className="h-2 w-2 rounded-full bg-unknown" />
          ) : (
            <LiveDot tone="ok" ping={hasData} />
          )}
          {stale ? 'RPC SLOW' : !hasData && q.isError ? 'NO CONNECTION' : hasData ? 'LIVE' : 'CONNECTING'} · BLOCK{' '}
          <span className="tnum">{block}</span>
        </p>
      </div>

      <p aria-live="polite" className="sr-only">
        {flashing ? `Alert: receipt ${flashing.ref} from ${flashing.controllerName} was altered in the database.` : ''}
      </p>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line lg:grid-cols-4">
        <KpiTile label="Match" value={hasData ? count('MATCH') : '--'} tone="ok" icon={<DotIcon name="check" size={14} />} hint="Database = chain" />
        <KpiTile
          label="Altered"
          value={hasData ? altered : '--'}
          tone="bad"
          icon={<DotIcon name="edit" size={14} />}
          hint="Edited after sealing"
          active={altered > 0}
        />
        <KpiTile label="Deleted" value={hasData ? count('DELETED') : '--'} tone="bad" icon={<DotIcon name="cross" size={14} />} hint="Row missing from database" />
        <KpiTile
          label="Not anchored"
          value={hasData ? count('NOT_ANCHORED') : '--'}
          tone="pending"
          icon={<DotIcon name="clock" size={14} />}
          hint="Never reached the chain"
        />
      </div>

      <div className="grid gap-8 xl:grid-cols-12">
        <div className="min-w-0 xl:col-span-8">
          <div className="mb-3 flex items-center justify-between">
            <p className="label text-ink-2">Receipts · problems first · every 3 s</p>
            {q.isFetching && hasData ? <span className="label text-[11px] text-ink-2">checking…</span> : null}
          </div>
          {stale ? (
            <div role="status" className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-unknown/30 bg-unknown-bg px-4 py-3">
              <p className="flex items-center gap-2 text-[14px] text-unknown">
                <IconClock size={16} className="shrink-0" />
                <span>
                  <strong className="font-medium">The chain node is slow.</strong> Showing the last check from block {block}
                  {ageSec ? `, ${ageSec} s ago` : ''}. This is not a sign of tampering.
                </span>
              </p>
              <Button variant="light" size="sm" icon={<IconRefresh size={15} />} onClick={onRetry}>
                Check now
              </Button>
            </div>
          ) : null}
          {q.isPending ? (
            <div className="flex flex-col gap-px overflow-hidden rounded-lg border border-line bg-line" aria-busy="true" aria-label="Loading receipts">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="flex items-center gap-6 bg-card p-4">
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-5 w-28" />
                  <Skeleton className="h-5 flex-1" />
                  <Skeleton className="h-6 w-20" />
                </div>
              ))}
            </div>
          ) : !hasData ? (
            <EmptyState
              icon={<IconAlert size={20} />}
              title="Watch can’t reach the chain node"
              body={`${q.error?.message ?? 'No answer.'} Nothing is shown, so nothing is decided. This is not a sign of tampering.`}
              action={
                <Button variant="light" size="sm" icon={<IconRefresh size={15} />} onClick={onRetry}>
                  Retry now
                </Button>
              }
            />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<DotIcon name="eye" size={18} />}
              title="No sealed receipts to watch yet"
              body="Rows appear here as soon as a controller seals its first access record on chain."
            />
          ) : (
            <div className={stale ? 'opacity-70 grayscale-[35%]' : ''}>
              <WatchTable rows={rows} selected={focus?.ref} onSelect={onSelectRow} flashRef={flashing?.ref ?? null} />
            </div>
          )}
        </div>

        <aside className="flex flex-col gap-5 xl:col-span-4">
          {q.isPending ? <Skeleton className="h-[300px] w-full rounded-xl" /> : <WhatChanged
              focus={focus}
              known={hasData && rows.length > 0}
              note={
                !hasData
                  ? 'No answer from the chain node yet, so nothing is compared.'
                  : rows.length === 0
                    ? 'Nothing to compare yet.'
                    : 'Every database row matches its sealed fingerprint.'
              }
            />}

          <section className="rounded-lg border border-line bg-card p-5">
            <p className="label text-ink">How Watch works</p>
            <ol className="mt-3 flex flex-col gap-2.5 text-[14px] leading-relaxed text-ink-2">
              <li>
                <span className="font-mono text-blue">01</span> Read every AccessLogged event from the journal contract.
              </li>
              <li>
                <span className="font-mono text-blue">02</span> Recompute each database row’s fingerprint.
              </li>
              <li>
                <span className="font-mono text-blue">03</span> Different fingerprint → <strong className="text-bad">ALTERED</strong>. Missing row →{' '}
                <strong className="text-bad">DELETED</strong>.
              </li>
            </ol>
          </section>
        </aside>
      </div>
    </div>
  )
}
