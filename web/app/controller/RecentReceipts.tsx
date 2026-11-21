'use client'

import { Badge, receiptBadgeKind } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { IconAlert, IconArrowUpRight, IconReceipt, IconRefresh, IconWallet } from '@/components/ui/icons'
import { Skeleton } from '@/components/ui/Skeleton'
import { explorerLink, maskCitizenCode, type RecentAccess } from '@/lib/data'
import { eventVerb, shortHex, timeAgo } from '@/lib/format'
import { useNow } from '@/lib/hooks'

export type RecentStatus = 'locked' | 'loading' | 'error' | 'ready'

/** "Recent receipts": last 10 records with type, masked citizen code, status and tx link. */
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
  return (
    <section className="overflow-hidden rounded-lg border border-line bg-card" aria-label="Recent receipts" aria-busy={status === 'loading'}>
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <p className="label text-ink">Recent receipts</p>
        {status === 'ready' && list.length ? <span className="label text-[11px] text-ink-2">Last {list.length}</span> : null}
      </div>
      {status === 'locked' ? (
        <div className="p-5">
          <EmptyState icon={<IconWallet size={20} />} title="Connect a registered wallet" body="Your last 10 records show here once the wallet checks pass." />
        </div>
      ) : status === 'loading' ? (
        <div className="flex flex-col gap-3 p-5" aria-label="Loading recent receipts">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-4 w-14" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-7 w-24" />
            </div>
          ))}
        </div>
      ) : status === 'error' ? (
        <div className="p-5">
          <EmptyState
            tone="pending"
            icon={<IconAlert size={20} />}
            title="Could not load recent receipts"
            body={error ?? 'Check your connection and try again.'}
            action={
              <Button variant="light" size="sm" icon={<IconRefresh size={15} />} onClick={onRetry}>
                Try again
              </Button>
            }
          />
        </div>
      ) : list.length === 0 ? (
        <div className="p-5">
          <EmptyState icon={<IconReceipt size={20} />} title="No records yet" body="Seal your first access on the left. It appears here in seconds." />
        </div>
      ) : (
        <ul>
          {list.map((r) => (
            <li key={r.id} className="flex items-center gap-3 border-b border-line px-5 py-3 last:border-b-0">
              <span className="tnum w-[64px] shrink-0 font-mono text-[13px] font-bold text-ink" title="Citizen code (masked)">
                {maskCitizenCode(r.citizenCode)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="label block truncate text-[11px] text-ink">{eventVerb(r.eventType)}</span>
                <span className="mt-0.5 flex flex-wrap items-center gap-x-2 font-mono text-[12px] text-ink-2">
                  <span className="whitespace-nowrap">{now ? timeAgo(r.createdAt, now) : '—'}</span>
                  {r.txHash ? (
                    <a
                      href={explorerLink('tx', r.txHash)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-0.5 whitespace-nowrap text-blue hover:underline"
                    >
                      {shortHex(r.txHash, 6, 4)}
                      <IconArrowUpRight size={11} />
                      <span className="sr-only">(opens the block explorer)</span>
                    </a>
                  ) : (
                    <span>no tx yet</span>
                  )}
                </span>
              </span>
              <Badge kind={receiptBadgeKind(r.status)} size="sm" />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
