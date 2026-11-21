'use client'

import { useEffect, useRef, useState } from 'react'
import { Scramble } from '@/components/controller/Scramble'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { IconAlert, IconArrowUpRight, IconReceipt, IconRefresh, IconWallet } from '@/components/ui/icons'
import { Skeleton } from '@/components/ui/Skeleton'
import { explorerLink, maskCitizenCode, type RecentAccess } from '@/lib/data'
import { eventVerb, shortHex, timeAgo } from '@/lib/format'
import { useNow } from '@/lib/hooks'
import { EVENT_LABELS, EVENT_TYPES, type RecordStatus } from '@/lib/shared/types'

export type RecentStatus = 'locked' | 'loading' | 'error' | 'ready'

const EMPTY: ReadonlySet<string> = new Set()

/**
 * Status dot + word (Vercel deployments grammar), without red: red is reserved for tampering.
 * Sealed = green, pending = amber with a pulse, not sealed = grey (nothing reached the chain).
 */
function StatusMark({ status }: { status: RecordStatus }) {
  const s =
    status === 'anchored'
      ? { label: 'Recorded', text: 'text-ink', dot: 'bg-ok' }
      : status === 'failed'
        ? { label: 'Not sealed', text: 'text-ink-2', dot: 'bg-ink-3' }
        : { label: 'Sealing…', text: 'text-pending', dot: 'bg-pending ctl-pulse-dot' }
  return (
    <span className={`inline-flex items-center gap-2 whitespace-nowrap text-[14px] font-medium ${s.text}`}>
      <span aria-hidden="true" className={`size-2 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  )
}

/** "Recent receipts": last 10 records with type, masked citizen code, status and tx link. New rows slide in. */
export function RecentReceipts({
  status,
  rows,
  error,
  onRetry,
}: {
  /** locked = wallet not ready, so no controller id to load for. */
  status: RecentStatus
  rows: RecentAccess[]
  error?: string | null
  onRetry?: () => void
}) {
  const now = useNow()
  const list = rows.slice(0, 10)
  const idsKey = list.map((r) => r.id).join('|')

  // Rows that were not in the previous list arrive with motion (slide + tint + hash scramble).
  const seen = useRef<Set<string> | null>(null)
  const [fresh, setFresh] = useState<ReadonlySet<string>>(EMPTY)
  useEffect(() => {
    if (status !== 'ready') return
    const ids = idsKey ? idsKey.split('|') : []
    const prev = seen.current
    const added = prev ? ids.filter((id) => !prev.has(id)) : ids
    // The first non-empty list is the initial load, not an arrival (several rows at once from nothing).
    if (!prev || (prev.size === 0 && added.length > 1)) {
      seen.current = new Set(ids)
      return
    }
    if (!added.length) return
    added.forEach((id) => seen.current?.add(id))
    setFresh(new Set(added))
  }, [status, idsKey])
  useEffect(() => {
    if (!fresh.size) return
    const t = setTimeout(() => setFresh(EMPTY), 4200)
    return () => clearTimeout(t)
  }, [fresh])

  const sealed = list.filter((r) => r.status === 'anchored').length

  return (
    <section className="flex flex-col gap-6" aria-label="Recent receipts" aria-busy={status === 'loading'}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-b border-line pb-4">
        <h2 className="text-[19px] font-medium tracking-[-0.015em] text-ink md:text-[22px]">
          Recent receipts <span className="text-ink-2">· your last ten, newest first</span>
        </h2>
        {status === 'ready' && list.length ? (
          <p className="font-mono text-[12px] text-ink-2">
            {list.length} shown <span aria-hidden="true">·</span> <span className="text-ok">{sealed} sealed</span>
          </p>
        ) : null}
      </div>

      {status === 'locked' ? (
        <p className="flex items-center gap-3 text-[15px] text-ink-2">
          <IconWallet size={18} className="shrink-0 text-ink-3" />
          Your last 10 records show here once the wallet checks pass.
        </p>
      ) : status === 'loading' ? (
        <div className="flex flex-col" aria-label="Loading recent receipts">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-6 border-b border-line py-4">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 flex-1" />
            </div>
          ))}
        </div>
      ) : status === 'error' ? (
        <EmptyState
          icon={<IconAlert size={20} />}
          title="Could not load recent receipts"
          body={error ?? 'Check your connection and try again.'}
          action={
            <Button variant="light" size="sm" icon={<IconRefresh size={15} />} onClick={onRetry}>
              Try again
            </Button>
          }
        />
      ) : list.length === 0 ? (
        <EmptyState icon={<IconReceipt size={20} />} title="No records yet" body="Seal your first access above. It appears here in seconds." />
      ) : (
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[620px] border-collapse text-left">
            <thead>
              <tr className="label text-[11px] text-ink-3">
                <th scope="col" className="pb-3 pl-4 font-normal">
                  Access · citizen
                </th>
                <th scope="col" className="pb-3 font-normal">
                  Status
                </th>
                <th scope="col" className="pb-3 pr-4 text-right font-normal">
                  Transaction
                </th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => {
                const isNew = fresh.has(r.id)
                return (
                  <tr key={r.id} className={`border-t border-line transition-colors hover:bg-card ${isNew ? 'ctl-row-new' : ''}`}>
                    <td className="relative py-3.5 pl-4 pr-6">
                      {isNew ? <span aria-hidden="true" className="ctl-row-bar absolute inset-y-2 left-0 w-[3px] rounded-full bg-blue" /> : null}
                      <span className="flex items-center gap-3.5">
                        <span className="flex min-w-0 flex-col gap-0.5">
                          <span className="text-[15px] font-medium text-ink">
                            {EVENT_LABELS[EVENT_TYPES[r.eventType]] ?? eventVerb(r.eventType)}
                            {isNew ? <span className="label ml-2 text-[11px] text-blue">New</span> : null}
                          </span>
                          <span className="tnum font-mono text-[13px] tracking-[0.12em] text-ink-2" title="Citizen code (masked)">
                            {maskCitizenCode(r.citizenCode)}
                          </span>
                        </span>
                      </span>
                    </td>
                    <td className="py-3.5 pr-6">
                      <span className="flex flex-col gap-0.5">
                        <StatusMark status={r.status} />
                        <span className="font-mono text-[13px] text-ink-2">
                          {r.blockNumber != null
                            ? `block ${r.blockNumber.toLocaleString('en-US')}`
                            : r.status === 'anchored'
                              ? 'sealed on chain'
                              : r.status === 'failed'
                                ? 'nothing on chain'
                                : 'waiting for a block'}
                        </span>
                      </span>
                    </td>
                    <td className="py-3.5 pr-4 text-right">
                      <span className="flex flex-col items-end gap-0.5">
                        {r.txHash ? (
                          <a
                            href={explorerLink('tx', r.txHash)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 whitespace-nowrap font-mono text-[13px] text-blue underline-offset-4 hover:underline"
                          >
                            <Scramble text={shortHex(r.txHash, 8, 6)} run={isNew} />
                            <IconArrowUpRight size={12} />
                            <span className="sr-only">(opens the block explorer)</span>
                          </a>
                        ) : (
                          <span className="font-mono text-[13px] text-ink-3">no tx yet</span>
                        )}
                        <span className="whitespace-nowrap font-mono text-[13px] text-ink-2">{now ? timeAgo(r.createdAt, now) : '—'}</span>
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
