'use client'

import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { initials } from '@/components/citizen/ReceiptRows'
import { AgencyPageHead, AgencyWalletPanel, TechProof, TxLink, VERB, TAIL, legalBasisLine } from '@/components/controller/AgencyKit'
import { IconAlert, IconCheck, IconChevronRight, IconRefresh } from '@/components/controller/agency-icons'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { CHAIN_NAME } from '@/components/ui/WalletGate'
import { getControllerRecent, maskCitizenCode, type RecentAccess } from '@/lib/data'
import { formatWIB, timeAgo } from '@/lib/format'
import { useNow } from '@/lib/hooks'
import { LEGAL_BASES, type RecordStatus } from '@/lib/shared/types'
import { SimulationNote } from '../RecordAccess'
import { useControllerWallet } from '../wallet'
import './access-log.css'

export type LogStatus = 'loading' | 'error' | 'ready'

const EMPTY: ReadonlySet<string> = new Set()

/** Plain status words. Red is reserved for tampering: sealing is amber, not sealed is grey. */
const STATUS: Record<RecordStatus, { text: string; cls: string; dot: string }> = {
  anchored: { text: 'Sealed', cls: 'text-ok', dot: 'bg-ok' },
  submitted: { text: 'Sealing…', cls: 'text-pending', dot: 'bg-pending' },
  pending: { text: 'Sealing…', cls: 'text-pending', dot: 'bg-pending' },
  failed: { text: 'Not sealed', cls: 'text-ink-2', dot: 'bg-ink-3' },
}

function StatusWord({ status }: { status: RecordStatus }) {
  const s = STATUS[status]
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-[14px] font-medium ${s.cls}`}>
      {status === 'anchored' ? <IconCheck size={14} strokeWidth={2.6} /> : <span aria-hidden="true" className={`size-1.5 rounded-full ${s.dot}`} />}
      {s.text}
    </span>
  )
}

function actionWord(r: RecentAccess): string {
  return VERB[r.eventType] === 'Shared' ? 'Shared with third party' : (VERB[r.eventType] ?? 'Accessed')
}

/** The API stores the legal basis, not free-text purpose: the basis is the purpose the citizen sees. */
function purposeWord(r: RecentAccess): string {
  return r.legalBasisKey ? LEGAL_BASES[r.legalBasisKey] : 'Not stated'
}

function timeShort(iso: string): string {
  return formatWIB(iso).replace(' WIB', '')
}

/** Rows that were not in the previous list arrive with motion (slide down 8px + blue wash, riset-ui/37 §5.1). */
function useFreshRows(status: LogStatus, list: RecentAccess[]) {
  const idsKey = list.map((r) => r.id).join('|')
  const seen = useRef<Set<string> | null>(null)
  const [fresh, setFresh] = useState<ReadonlySet<string>>(EMPTY)
  useEffect(() => {
    if (status !== 'ready') return
    const ids = idsKey ? idsKey.split('|') : []
    const prev = seen.current
    const added = prev ? ids.filter((id) => !prev.has(id)) : ids
    // The first non-empty list is the initial load, not an arrival.
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
    const t = setTimeout(() => setFresh(EMPTY), 1400)
    return () => clearTimeout(t)
  }, [fresh])
  return fresh
}

// ---- side sheet (desktop) / bottom sheet (phone) -------------------------------------------------

function Sheet({ open, onClose, label, children }: { open: boolean; onClose: () => void; label: string; children: ReactNode }) {
  const [leaving, setLeaving] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const returnTo = useRef<HTMLElement | null>(null)

  const close = useCallback(() => {
    if (leaving) return
    const instant = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (instant) return onClose()
    setLeaving(true)
    setTimeout(() => {
      setLeaving(false)
      onClose()
    }, 200)
  }, [leaving, onClose])

  useEffect(() => {
    if (!open) return
    returnTo.current = document.activeElement as HTMLElement | null
    closeRef.current?.focus({ preventScroll: true })
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
      returnTo.current?.focus?.({ preventScroll: true })
    }
  }, [open])

  if (!open) return null

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      close()
      return
    }
    if (e.key !== 'Tab' || !panelRef.current) return
    // Keep focus inside the sheet.
    const f = panelRef.current.querySelectorAll<HTMLElement>('a[href], button, summary, [tabindex]:not([tabindex="-1"])')
    if (!f.length) return
    const first = f[0]
    const last = f[f.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  return (
    <div className="fixed inset-0 z-50" onKeyDown={onKeyDown} data-leaving={leaving || undefined}>
      <div aria-hidden="true" className="al-scrim absolute inset-0 bg-ink/25" onClick={close} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="al-sheet absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col rounded-t-[20px] bg-paper shadow-[0_-12px_40px_rgb(30_26_22/0.18)] lg:inset-y-0 lg:left-auto lg:right-0 lg:max-h-none lg:w-[460px] lg:rounded-none lg:rounded-l-[20px] lg:shadow-[-12px_0_40px_rgb(30_26_22/0.14)]"
      >
        <div aria-hidden="true" className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-line-strong lg:hidden" />
        <div className="flex shrink-0 items-center justify-between gap-3 px-5 pb-2 pt-3 lg:px-6 lg:pt-5">
          <p className="text-[15px] font-semibold text-ink">{label}</p>
          <button
            ref={closeRef}
            type="button"
            onClick={close}
            className="inline-flex min-h-10 items-center rounded-md px-3 text-[14px] font-medium text-ink-2 transition-colors duration-150 hover:bg-paper-2 hover:text-ink"
          >
            Close
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[calc(20px+env(safe-area-inset-bottom))] lg:px-6 lg:pb-8">{children}</div>
      </div>
    </div>
  )
}

/** One receipt as the agency's copy: the same facts the citizen's phone shows, chain data only in Technical proof. */
function ReceiptCopy({ row, agencyName }: { row: RecentAccess; agencyName: string }) {
  const facts: Array<[string, ReactNode]> = [
    ['Citizen', <span key="c" className="tnum font-mono tracking-[0.12em]">{maskCitizenCode(row.citizenCode)}</span>],
    ['Action', actionWord(row)],
    ['Purpose', purposeWord(row)],
    ['Legal basis', row.legalBasisKey ? legalBasisLine(row.legalBasisKey) : 'Not stated'],
    ['Recorded', formatWIB(row.createdAt)],
    ['Status', <StatusWord key="s" status={row.status} />],
  ]
  const sealed = row.status === 'anchored'
  return (
    <div className="flex flex-col gap-5">
      <div className="st-shadow relative">
        <article aria-label="Agency copy of the citizen's receipt" className="ag-carbon">
          <div className="st-half-top relative rounded-t-[16px] bg-card px-5 pb-6 pt-5">
            <div className="flex min-w-0 items-center gap-3">
              <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-blue-bg text-[14px] font-semibold text-blue">
                {initials(agencyName)}
              </span>
              <span className="min-w-0">
                <span className="line-clamp-2 break-words text-[15px] font-semibold leading-tight text-ink">{agencyName}</span>
                <span className="mt-0.5 flex items-center gap-1.5 text-[13px] text-ink-2">
                  <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-blue" />
                  Agency copy · the citizen gets the original
                </span>
              </span>
            </div>
            <p className="mt-5 min-w-0">
              <span className="block text-[44px] font-semibold leading-[0.92] tracking-[-0.045em] text-ink">{VERB[row.eventType] ?? 'Accessed'}</span>
              <span className="mt-1.5 block text-[19px] leading-tight tracking-[-0.01em] text-ink-2">{TAIL[row.eventType] ?? 'your data'}.</span>
            </p>
            <p className="mt-4">
              <span
                className={`inline-flex h-8 items-center gap-1.5 rounded-pill px-3 text-[14px] font-medium ${
                  sealed ? 'bg-ok-bg text-ok' : row.status === 'failed' ? 'bg-paper-2 text-ink-2' : 'bg-pending-bg text-pending'
                }`}
              >
                {sealed ? <IconCheck size={14} strokeWidth={2.6} /> : null}
                {sealed ? 'Sealed on the public ledger' : row.status === 'failed' ? 'Not sealed' : 'Sealing…'}
              </span>
            </p>
            <span aria-hidden="true" className="st-perf absolute bottom-0 left-5 right-5 text-line-strong" />
          </div>
          <dl className="st-half-bottom rounded-b-[16px] bg-card py-1.5">
            {facts.map(([k, v], i) => (
              <div key={k} className={`flex min-h-12 items-center gap-4 px-5 py-2.5 ${i ? 'border-t border-line/70' : ''}`}>
                <dt className="w-[96px] shrink-0 text-[14px] text-ink-2">{k}</dt>
                <dd className="min-w-0 flex-1 break-words text-right text-[15px] text-ink">{v}</dd>
              </div>
            ))}
          </dl>
        </article>
      </div>

      {row.status === 'failed' ? (
        <p className="flex items-start gap-2.5 rounded-[12px] bg-paper-2/70 p-4 text-[14px] leading-relaxed text-ink-2">
          <IconAlert size={16} className="mt-0.5 shrink-0 text-ink-3" />
          <span>
            <span className="font-medium text-ink">Nothing reached the public ledger.</span> {row.failReason ? `Reason: ${row.failReason}.` : 'The citizen got no receipt for this lookup.'}
          </span>
        </p>
      ) : null}

      <TechProof
        rows={[
          ['Transaction', row.txHash ? <TxLink hash={row.txHash} /> : null],
          ['Block', row.blockNumber != null ? row.blockNumber.toLocaleString('en-US') : null],
          ['Log index', row.logIndex != null ? String(row.logIndex) : null],
          ['Network', row.txHash || row.blockNumber != null ? CHAIN_NAME : null],
          ['Record id', row.id],
        ]}
      />
    </div>
  )
}

// ---- view ---------------------------------------------------------------------------------------

/** /controller/log content, fully controlled except which row is open. Gallery renders it with fixtures. */
export function AccessLogView({
  agencyName,
  status,
  rows,
  error,
  onRetry,
  initialOpenId = null,
}: {
  agencyName: string
  status: LogStatus
  rows: RecentAccess[]
  error?: string | null
  onRetry?: () => void
  initialOpenId?: string | null
}) {
  const now = useNow()
  const list = rows.slice(0, 10)
  const fresh = useFreshRows(status, list)
  const [openId, setOpenId] = useState<string | null>(initialOpenId)
  const open = openId ? list.find((r) => r.id === openId) ?? null : null

  const rowKey = (id: string) => (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setOpenId(id)
    }
  }

  let body: ReactNode
  if (status === 'loading') {
    body = (
      <div className="ag-group overflow-hidden" aria-label="Loading the access log">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className={`flex items-center gap-6 px-5 py-4 ${i ? 'border-t border-line' : ''}`}>
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="hidden h-4 w-20 lg:block" />
            <Skeleton className="h-4 flex-1" />
          </div>
        ))}
      </div>
    )
  } else if (status === 'error') {
    body = (
      <div className="ag-group flex flex-col items-start gap-3 p-6" role="alert">
        <p className="text-[16px] font-medium text-ink">Could not load the access log</p>
        <p className="text-[15px] leading-relaxed text-ink-2">{error ?? 'Check your connection and try again.'}</p>
        <Button variant="light" size="sm" icon={<IconRefresh size={15} />} onClick={onRetry}>
          Try again
        </Button>
      </div>
    )
  } else if (!list.length) {
    body = (
      <div className="ag-group flex flex-col items-start gap-1.5 p-6">
        <p className="text-[16px] font-medium text-ink">No lookups recorded yet</p>
        <p className="text-[15px] leading-relaxed text-ink-2">Record an access in the agency system. It shows here a few seconds after it is sealed.</p>
      </div>
    )
  } else {
    body = (
      <div className="ag-group overflow-hidden">
        {/* desktop: table */}
        <table className="hidden w-full border-collapse text-left lg:table">
          <caption className="sr-only">Access log, newest first. Select a row to open the agency copy.</caption>
          <thead>
            <tr className="text-[13px] text-ink-3">
              <th scope="col" className="py-3 pl-5 pr-4 font-normal">Time</th>
              <th scope="col" className="py-3 pr-4 font-normal">Citizen</th>
              <th scope="col" className="py-3 pr-4 font-normal">Action</th>
              <th scope="col" className="py-3 pr-4 font-normal">Purpose</th>
              <th scope="col" className="py-3 pr-5 font-normal">Status</th>
              <th scope="col" className="w-10 py-3 pr-4"><span className="sr-only">Open</span></th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr
                key={r.id}
                tabIndex={0}
                aria-selected={openId === r.id}
                aria-label={`${actionWord(r)}, citizen ${maskCitizenCode(r.citizenCode)}, ${formatWIB(r.createdAt)}. Open the agency copy.`}
                onClick={() => setOpenId(r.id)}
                onKeyDown={rowKey(r.id)}
                className={`ag-tr border-t border-line outline-none focus-visible:bg-blue-bg ${fresh.has(r.id) ? 'ag-row-new' : ''}`}
              >
                <td className="py-3.5 pl-5 pr-4">
                  <span className="block whitespace-nowrap text-[15px] text-ink tnum">{timeShort(r.createdAt)}</span>
                  <span className="block text-[13px] text-ink-3">{now ? timeAgo(r.createdAt, now) : '—'}</span>
                </td>
                <td className="py-3.5 pr-4 font-mono text-[14px] tracking-[0.12em] text-ink tnum">{maskCitizenCode(r.citizenCode)}</td>
                <td className="py-3.5 pr-4 text-[15px] font-medium text-ink">{actionWord(r)}</td>
                <td className="py-3.5 pr-4 text-[15px] text-ink-2">{purposeWord(r)}</td>
                <td className="py-3.5 pr-5"><StatusWord status={r.status} /></td>
                <td className="py-3.5 pr-4 text-ink-3"><IconChevronRight size={16} /></td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* phone: two-line rows */}
        <ul className="lg:hidden" aria-label="Access log, newest first">
          {list.map((r, i) => (
            <li key={r.id} className={i ? 'border-t border-line' : ''}>
              <button
                type="button"
                onClick={() => setOpenId(r.id)}
                className={`ag-tr flex min-h-[64px] w-full items-center gap-3 px-4 py-3 text-left ${fresh.has(r.id) ? 'ag-row-new' : ''}`}
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-[16px] font-medium text-ink">{actionWord(r)}</span>
                    <StatusWord status={r.status} />
                  </span>
                  <span className="mt-0.5 block truncate text-[13px] text-ink-3">
                    <span className="font-mono tracking-[0.1em] text-ink-2">{maskCitizenCode(r.citizenCode)}</span> · {timeShort(r.createdAt)} · {purposeWord(r)}
                  </span>
                </span>
                <IconChevronRight size={16} className="shrink-0 text-ink-3" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  const sealedCount = list.filter((r) => r.status === 'anchored').length
  return (
    <section aria-label="Access log" aria-busy={status === 'loading'} className="flex flex-col gap-3">
      {status === 'ready' && list.length ? (
        <p className="px-1 text-[13px] text-ink-3">
          Last {list.length} lookups · {sealedCount} sealed
        </p>
      ) : null}
      {body}
      <Sheet open={Boolean(open)} onClose={() => setOpenId(null)} label="Receipt">
        {open ? <ReceiptCopy row={open} agencyName={agencyName} /> : null}
      </Sheet>
    </section>
  )
}

/**
 * /controller/log: the agency's last ten records. Reads the same query key as /controller, so a seal there
 * refreshes this list.
 */
export function AccessLog() {
  const { wallet, onConnect, onSwitchNetwork, onRefresh, onCopy } = useControllerWallet()
  const ready = wallet.state === 'ready' && !wallet.isChecking
  const controllerId = wallet.controller?.id
  const recent = useQuery({
    queryKey: ['controller', 'recent', controllerId],
    queryFn: () => getControllerRecent(controllerId ?? '0x'),
    enabled: ready && Boolean(controllerId),
    retry: false,
  })
  const status: LogStatus = recent.isPending ? 'loading' : recent.isError ? 'error' : 'ready'
  return (
    <div>
      <AgencyPageHead title="Access log" description="Every lookup this agency recorded, newest first. Each one is a receipt on the citizen’s phone." />
      <SimulationNote />
      {ready ? (
        <AccessLogView
          agencyName={wallet.controller?.name ?? 'Your agency'}
          status={status}
          rows={recent.data ?? []}
          error={recent.error?.message}
          onRetry={() => void recent.refetch()}
        />
      ) : (
        <AgencyWalletPanel wallet={wallet} onConnect={onConnect} onSwitchNetwork={onSwitchNetwork} onRefresh={onRefresh} onCopy={onCopy} />
      )}
    </div>
  )
}
