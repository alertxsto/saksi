'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useId, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { IconArrow, IconRefresh } from '@/components/ui/icons'
import { Skeleton } from '@/components/ui/Skeleton'
import { Quiet } from '@/components/regulator/Quiet'
import { RiseHeading } from '@/components/regulator/Rise'
import { StatRow } from '@/components/regulator/StatRow'
import { getBreachList, type BreachDetailView, type BreachListWire } from '@/lib/data'
import { formatWIB } from '@/lib/format'
import type { BreachRow } from '@/lib/shared/types'
import { BreachDetailLoader, breachBadge } from './BreachDetail'

function ListSkeleton() {
  return (
    <div className="grid gap-10 lg:grid-cols-12" aria-busy="true" aria-label="Loading notices">
      <ul className="flex flex-col border-t border-line lg:col-span-5">
        {Array.from({ length: 4 }, (_, i) => (
          <li key={i} className="flex flex-col gap-3 border-b border-line py-5">
            <span className="flex items-start justify-between gap-3">
              <Skeleton className="h-5 w-3/5" />
              <Skeleton className="h-7 w-24" />
            </span>
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-1 w-full" />
          </li>
        ))}
      </ul>
      <div className="hidden lg:col-span-7 lg:block">
        <Skeleton className="h-[480px] w-full" />
      </div>
    </div>
  )
}

/** Hours used against the 72 h window: hairline track, ink/green fill, amber overrun past the limit. */
function MiniWindow({ r }: { r: BreachRow }) {
  const span = Math.max(84, r.hoursUsed + 8)
  const late = r.mode === 'late'
  const at = (h: number) => `${(Math.min(h, span) / span) * 100}%`
  return (
    <span aria-hidden="true" className="relative mt-1 block h-[5px] w-full">
      <span className="absolute inset-x-0 top-[2px] h-px bg-line" />
      <span className={`absolute left-0 top-[1px] h-[3px] rounded-full ${late ? 'bg-ink' : 'bg-ok'}`} style={{ width: at(Math.min(r.hoursUsed, 72)) }} />
      {late ? <span className="absolute top-0 h-[5px] rounded-full bg-pending" style={{ left: at(72), width: at(r.hoursUsed - 72) }} /> : null}
      <span className="absolute -top-[3px] h-[11px] w-px bg-ink-3" style={{ left: at(72) }} />
    </span>
  )
}

function RowBody({ r }: { r: BreachRow }) {
  return (
    <>
      <span className="flex items-start justify-between gap-4">
        <span className="text-[16px] font-medium leading-snug tracking-[-0.01em] text-ink">{r.title}</span>
        {breachBadge(r)}
      </span>
      <span className="label text-[11px] text-ink-2">
        {r.controllerName.replace(' (fictional)', '')} · {formatWIB(r.detectedAt * 1000)}
      </span>
      <MiniWindow r={r} />
    </>
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
    <div className="flex flex-col gap-10 md:gap-12">
      <div className="grid gap-6 print:hidden lg:grid-cols-12 lg:items-end">
        <RiseHeading as="h1" lead="On time is a fact," tail="not a promise." className="text-[34px] leading-[1.04] md:text-[56px] lg:col-span-7" />
        <p className="max-w-[46ch] text-[16px] leading-[1.6] tracking-[0.01em] text-ink-2 md:text-[17px] lg:col-span-4 lg:col-start-9">
          UU PDP Art. 46 gives a company 72 hours. Each notice below is sealed with its own block time, and the contract
          decides on time or late.
        </p>
      </div>

      <div className="print:hidden">
        <StatRow
          label="Breach notices"
          stats={[
            { label: 'Notices', value: stats ? stats.total : null, hint: 'Sealed on chain', tone: 'ink' },
            { label: 'On time', value: stats ? stats.onTime : null, hint: 'Within 72 hours', tone: 'ok' },
            { label: 'Late', value: stats ? stats.late : null, hint: 'Recorded by the contract', tone: 'pending' },
          ]}
        />
      </div>

      {q.isPending ? (
        <ListSkeleton />
      ) : q.isError ? (
        <Quiet
          glyph="eye"
          title="Couldn’t load notices"
          body={`${q.error.message} The counts above stay empty until the list loads.`}
          action={
            <Button variant="light" size="sm" icon={<IconRefresh size={15} />} onClick={onRetry}>
              Try again
            </Button>
          }
        />
      ) : rows.length === 0 ? (
        <Quiet glyph="clock" title="No breach notices yet" body="Notices appear here as soon as a controller seals one on chain." />
      ) : (
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="self-start lg:sticky lg:top-24 lg:col-span-5 print:hidden">
            <h2 className="mb-3 text-[19px] font-medium tracking-[-0.015em] text-ink md:text-[22px]">
              Notices <span className="text-ink-2">· hours used of 72</span>
            </h2>
            <ul className="flex flex-col border-t border-line" aria-label="Notices">
              {rows.map((r) => {
                const active = current?.id === r.id
                return (
                  <li key={r.id} className="border-b border-line">
                    <button
                      type="button"
                      onClick={() => onSelectBreach(r.id)}
                      aria-current={active ? 'true' : undefined}
                      className={`relative -mx-3 hidden w-[calc(100%+24px)] flex-col gap-2.5 rounded-md px-3 py-4 text-left transition-colors duration-200 lg:flex ${
                        active ? 'bg-card' : 'hover:bg-card/60'
                      }`}
                    >
                      {active ? <span aria-hidden="true" className="absolute -left-1 top-5 size-[7px] rounded-full bg-blue" /> : null}
                      <RowBody r={r} />
                    </button>
                    <Link href={`/regulator/breach/${r.id}`} className="flex flex-col gap-2.5 py-4 lg:hidden">
                      <RowBody r={r} />
                      <span className="label flex items-center gap-1 text-[11px] text-ink-2">
                        Open notice <IconArrow size={12} />
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
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
