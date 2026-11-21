'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useId, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { TwoTone } from '@/components/ui/Chip'
import { DotIcon } from '@/components/ui/DotIcon'
import { EmptyState } from '@/components/ui/EmptyState'
import { IconAlert, IconArrow, IconClock, IconRefresh } from '@/components/ui/icons'
import { KpiTile } from '@/components/ui/KpiTile'
import { Skeleton } from '@/components/ui/Skeleton'
import { getBreachList, type BreachDetailView, type BreachListWire } from '@/lib/data'
import { formatWIB } from '@/lib/format'
import { BreachDetailLoader, breachBadge } from './BreachDetail'

function ListSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-12" aria-busy="true" aria-label="Loading notices">
      <ul className="flex flex-col overflow-hidden rounded-lg border border-line bg-card lg:col-span-5">
        {Array.from({ length: 4 }, (_, i) => (
          <li key={i} className="flex flex-col gap-2 border-b border-line px-5 py-4 last:border-b-0">
            <span className="flex items-start justify-between gap-3">
              <Skeleton className="h-5 w-3/5" />
              <Skeleton className="h-6 w-24" />
            </span>
            <Skeleton className="h-3.5 w-2/5" />
          </li>
        ))}
      </ul>
      <div className="hidden lg:col-span-7 lg:block">
        <Skeleton className="h-[420px] w-full" />
      </div>
    </div>
  )
}

/**
 * Breach notices: total / on time / late, a list with ON TIME · N H / LATE · N H badges and, on
 * desktop, the selected notice beside it. On small screens a row opens /regulator/breach/[id].
 */
/** `load` / `loadDetail` come from the /dev gallery (mock data); the app uses GET /api/regulator/breaches. */
export function BreachList({
  load,
  loadDetail,
}: {
  load?: () => Promise<BreachListWire>
  loadDetail?: (id: string) => Promise<BreachDetailView | null>
}) {
  const instance = useId()
  const q = useQuery({ queryKey: ['breach-list', load ? instance : 'live'], queryFn: load ?? getBreachList, retry: false })
  const [sel, setSel] = useState<string | null>(null)
  const rows = q.data?.rows ?? []
  const stats = q.data?.stats
  const current = rows.find((r) => r.id === sel) ?? rows[0]

  const onRetry = () => void q.refetch()
  const onSelectBreach = (id: string) => setSel(id)

  return (
    <div className="flex flex-col gap-8">
      <div className="print:hidden">
        <TwoTone head="On time is a fact," tail="not a promise." className="text-[34px] md:text-[48px]" />
      </div>

      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3 print:hidden">
        <KpiTile label="Notices" value={stats ? stats.total : '--'} icon={<DotIcon name="eye" size={14} />} hint="Sealed on chain" />
        <KpiTile label="On time" value={stats ? stats.onTime : '--'} tone="ok" icon={<DotIcon name="check" size={14} />} hint="Within 72 hours" />
        <KpiTile label="Late" value={stats ? stats.late : '--'} tone="bad" icon={<DotIcon name="clock" size={14} />} hint="Recorded by the contract" />
      </div>

      {q.isPending ? (
        <ListSkeleton />
      ) : q.isError ? (
        <EmptyState
          icon={<IconAlert size={20} />}
          title="Couldn’t load notices"
          body={`${q.error.message} The counts above stay empty until the list loads.`}
          action={
            <Button variant="light" size="sm" icon={<IconRefresh size={15} />} onClick={onRetry}>
              Try again
            </Button>
          }
        />
      ) : rows.length === 0 ? (
        <EmptyState icon={<IconClock size={20} />} title="No breach notices yet" body="Notices appear here as soon as a controller seals one on chain." />
      ) : (
        <div className="grid gap-8 lg:grid-cols-12">
          <ul className="flex flex-col self-start overflow-hidden rounded-lg border border-line bg-card lg:col-span-5 print:hidden" aria-label="Notices">
            {rows.map((r) => {
              const active = current?.id === r.id
              return (
                <li key={r.id} className="border-b border-line last:border-b-0">
                  <button
                    type="button"
                    onClick={() => onSelectBreach(r.id)}
                    aria-current={active ? 'true' : undefined}
                    className={`relative hidden w-full flex-col gap-2 px-5 py-4 text-left transition-colors lg:flex ${
                      active ? 'bg-paper' : 'hover:bg-paper/60'
                    }`}
                  >
                    {active ? <span aria-hidden="true" className="absolute inset-y-0 left-0 w-[3px] bg-blue" /> : null}
                    <span className="flex items-start justify-between gap-3">
                      <span className="text-[15px] font-medium leading-snug text-ink">{r.title}</span>
                      {breachBadge(r)}
                    </span>
                    <span className="label text-[11px] text-ink-2">
                      {r.controllerName.replace(' (fictional)', '')} · {formatWIB(r.detectedAt * 1000)}
                    </span>
                  </button>
                  <Link href={`/regulator/breach/${r.id}`} className="flex flex-col gap-2 px-5 py-4 lg:hidden">
                    <span className="flex items-start justify-between gap-3">
                      <span className="text-[15px] font-medium leading-snug text-ink">{r.title}</span>
                      {breachBadge(r)}
                    </span>
                    <span className="label flex items-center gap-1 text-[11px] text-ink-2">
                      {r.controllerName.replace(' (fictional)', '')} <IconArrow size={12} />
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
          <div className="hidden lg:col-span-7 lg:block print:col-span-12 print:block">
            {current ? <BreachDetailLoader key={current.id} id={current.id} load={loadDetail} /> : null}
            {current ? (
              <Link
                href={`/regulator/breach/${current.id}`}
                className="label no-print mt-4 inline-flex min-h-11 items-center gap-2 text-ink-2 hover:text-blue"
              >
                Open full page <IconArrow size={13} />
              </Link>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}
