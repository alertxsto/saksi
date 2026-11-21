'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useId, useState, useSyncExternalStore, type FormEvent } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button, ButtonLink } from '@/components/ui/Button'
import { LiveDot, SectionIndex, TwoTone } from '@/components/ui/Chip'
import { DotIcon } from '@/components/ui/DotIcon'
import { EmptyState } from '@/components/ui/EmptyState'
import { IconAlert, IconArrowUpRight, IconLock, IconMinus, IconReceipt, IconRefresh, IconTrash } from '@/components/ui/icons'
import { KpiTile } from '@/components/ui/KpiTile'
import { Skeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import {
  ApiClientError,
  explorerLink,
  getDemoReceipts,
  getServiceStatus,
  getWatchSummary,
  tamperReceipt,
  watchKey,
  type DemoReceipt,
  type ServiceStatus,
  type TamperAction,
  type WatchSummary,
} from '@/lib/data'
import { eventVerb, shortHex, timeAgo } from '@/lib/format'
import type { WatchRow } from '@/lib/shared/types'
import { useNow } from '@/lib/hooks'

const WATCH_MS = 3000
const RECEIPTS_MS = 10_000
// The status probe runs a tiny AI completion, so it refreshes slowly and on demand.
const STATUS_MS = 60_000

// ---- token: sessionStorage only (never URL, cookies or logs) -------------------------------------
const TOKEN_KEY = 'saksi.operator.token'
const tokenListeners = new Set<() => void>()
// In-memory copy for browsers where sessionStorage throws (private windows, blocked site data).
let memoryToken = ''

function readToken(): string {
  try {
    return sessionStorage.getItem(TOKEN_KEY) ?? memoryToken
  } catch {
    return memoryToken
  }
}

function writeToken(value: string | null) {
  memoryToken = value ?? ''
  try {
    if (value) sessionStorage.setItem(TOKEN_KEY, value)
    else sessionStorage.removeItem(TOKEN_KEY)
  } catch {
    /* Storage unavailable: the in-memory copy lasts until the tab reloads. */
  }
  tokenListeners.forEach((listener) => listener())
}

function subscribeToken(listener: () => void) {
  tokenListeners.add(listener)
  return () => tokenListeners.delete(listener)
}

const useToken = () => useSyncExternalStore(subscribeToken, readToken, () => '')
const rejected = (error: unknown) => error instanceof ApiClientError && error.status === 403
const messageOf = (error: unknown) => (error instanceof Error ? error.message : 'Something went wrong.')
const refOf = (id: string) => `R.${id.replace(/-/g, '').slice(0, 8).toUpperCase()}`

const DONE: Record<TamperAction, string> = {
  edit: 'edited: the database now says READ',
  delete: 'deleted from the database',
  restore: 'restored to its recorded state',
}

// ---- token gate ---------------------------------------------------------------------------------

function TokenGate() {
  const id = useId()
  const { toast } = useToast()
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const candidate = value.trim()
    if (!candidate) return setError('Paste the demo admin token first.')
    setChecking(true)
    setError(null)
    try {
      await getDemoReceipts(candidate)
      writeToken(candidate)
      setValue('')
      toast('Console unlocked for this tab')
    } catch (err) {
      setError(rejected(err) ? 'That token was rejected. Check DEMO_ADMIN_TOKEN on the server.' : messageOf(err))
    } finally {
      setChecking(false)
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mx-auto flex w-full max-w-[560px] flex-col gap-5 rounded-lg border border-line bg-card p-5 md:p-6">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-sm bg-pending-bg text-pending">
          <IconLock size={20} />
        </span>
        <div>
          <p className="text-[18px] font-medium text-ink">Unlock the presenter console</p>
          <p className="text-[14px] text-ink-2">Kept in this tab only. Closing the tab forgets it.</p>
        </div>
      </div>
      <div>
        <label htmlFor={id} className="label text-ink">
          Demo admin token
        </label>
        <input
          id={id}
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          aria-invalid={Boolean(error)}
          aria-describedby={`${id}-h`}
          className="mt-2 h-14 w-full rounded-md border border-line-strong bg-paper-2 px-4 font-mono text-[18px] text-ink outline-none placeholder:text-ink-3 focus:border-blue aria-[invalid=true]:border-bad"
          placeholder="DEMO_ADMIN_TOKEN"
        />
        <p id={`${id}-h`} role={error ? 'alert' : undefined} className={`mt-1.5 text-[13px] ${error ? 'text-bad' : 'text-ink-2'}`}>
          {error ?? 'Sent only as the x-demo-token header, never in the address bar.'}
        </p>
      </div>
      <Button type="submit" size="lg" arrow loading={checking} full>
        Unlock
      </Button>
    </form>
  )
}

// ---- receipts -----------------------------------------------------------------------------------

const STATE_LABEL: Record<DemoReceipt['state'], { text: string; className: string }> = {
  intact: { text: 'As recorded', className: 'text-ok' },
  edited: { text: 'Edited by demo', className: 'text-bad' },
  deleted: { text: 'Deleted by demo', className: 'text-bad' },
}

function ReceiptRow({
  row,
  verdict,
  watchReady,
  busy,
  locked,
  onAction,
}: {
  row: DemoReceipt
  verdict: WatchRow['status'] | undefined
  watchReady: boolean
  busy: TamperAction | null
  locked: boolean
  onAction: (action: TamperAction) => void
}) {
  const now = useNow()
  const [confirming, setConfirming] = useState(false)
  const state = STATE_LABEL[row.state]
  const live = row.state !== 'deleted'
  return (
    <li className={`flex flex-col gap-4 border-b border-line p-5 last:border-b-0 ${row.state === 'intact' ? '' : 'bg-bad-bg/40'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="tnum font-mono text-[22px] font-bold text-ink">{refOf(row.id)}</p>
          <p className="mt-0.5 text-[15px] text-ink-2">{row.controllerName}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[13px] text-ink-2">
            <span className="label text-[12px] text-ink">{eventVerb(row.eventType)}</span>
            <span>{now ? timeAgo(row.createdAt, now) : '—'}</span>
            {row.txHash ? (
              <a
                href={explorerLink('tx', row.txHash)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-0.5 text-blue hover:underline"
              >
                {shortHex(row.txHash, 6, 4)}
                <IconArrowUpRight size={11} />
                <span className="sr-only">(opens the block explorer)</span>
              </a>
            ) : null}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <p className={`label text-[12px] ${state.className}`}>DB · {state.text}</p>
          {verdict ? (
            <Badge kind={verdict} suffix="Watch" />
          ) : (
            <span className="label text-[12px] text-ink-3">{watchReady ? 'Watch · not seen yet' : 'Watch · checking…'}</span>
          )}
        </div>
      </div>

      {confirming ? (
        <div role="group" aria-label={`Confirm deleting ${refOf(row.id)}`} className="flex flex-col gap-3 rounded-md border border-bad/40 bg-card p-4">
          <p className="text-[15px] text-ink">
            Delete <span className="font-mono font-bold">{refOf(row.id)}</span> from the database? Restore brings it back.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="danger"
              size="lg"
              icon={<IconTrash size={18} />}
              loading={busy === 'delete'}
              disabled={locked}
              onClick={() => {
                setConfirming(false)
                onAction('delete')
              }}
            >
              Yes, delete row
            </Button>
            <Button variant="ghost" size="lg" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-3">
          {row.editable ? (
            <Button variant="dark" size="lg" icon={<DotIcon name="edit" size={16} />} loading={busy === 'edit'} disabled={locked} onClick={() => onAction('edit')}>
              Edit (change action to {eventVerb(row.eventType === 0 ? 3 : 0)})
            </Button>
          ) : null}
          {live ? (
            <Button variant="danger" size="lg" icon={<IconTrash size={18} />} loading={busy === 'delete'} disabled={locked} onClick={() => setConfirming(true)}>
              Delete row
            </Button>
          ) : null}
          <Button
            variant="blue"
            size="lg"
            icon={<IconRefresh size={18} />}
            loading={busy === 'restore'}
            disabled={locked || !row.restorable}
            onClick={() => onAction('restore')}
          >
            Restore
          </Button>
        </div>
      )}
    </li>
  )
}

// ---- side panels --------------------------------------------------------------------------------

function WatchSummaryPanel({ data, error, updatedAt }: { data: WatchSummary | undefined; error: boolean; updatedAt: number }) {
  const now = useNow()
  const age = data && now ? Math.max(0, Math.round((now - updatedAt) / 1000)) : 0
  const value = (n: number | undefined) => (data ? (n ?? 0) : '--')
  return (
    <section aria-label="Watch summary" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <SectionIndex n="02">Watch · every 3 s</SectionIndex>
        <p className="label inline-flex items-center gap-2 text-[11px] text-ink-2">
          {error ? <span aria-hidden="true" className="h-2 w-2 rounded-full bg-unknown" /> : <LiveDot tone="ok" ping={Boolean(data)} />}
          {error ? 'RPC SLOW' : data ? `BLOCK ${data.blockNumber.toLocaleString('en-US')}${age > 5 ? ` · ${age} s ago` : ''}` : 'CONNECTING'}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line">
        <KpiTile label="Match" value={value(data?.stats.MATCH)} tone="ok" icon={<DotIcon name="check" size={14} />} />
        <KpiTile label="Altered" value={value(data?.stats.ALTERED)} tone="bad" icon={<DotIcon name="edit" size={14} />} active={(data?.stats.ALTERED ?? 0) > 0} />
        <KpiTile label="Deleted" value={value(data?.stats.DELETED)} tone="bad" icon={<DotIcon name="cross" size={14} />} active={(data?.stats.DELETED ?? 0) > 0} />
        <KpiTile label="Not anchored" value={value(data?.stats.NOT_ANCHORED)} tone="pending" icon={<DotIcon name="clock" size={14} />} />
      </div>
      <ButtonLink href="/regulator/watch" external variant="light" size="md" arrow full>
        Open regulator Watch
      </ButtonLink>
    </section>
  )
}

function StatusLine({ label, ok, detail }: { label: string; ok: boolean | null; detail: string }) {
  return (
    <li className="flex items-center justify-between gap-3 bg-card px-4 py-3">
      <span className="flex items-center gap-2.5">
        <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${ok === null ? 'bg-unknown' : ok ? 'bg-ok' : 'bg-bad'}`} />
        <span className="label text-[12px] text-ink">{label}</span>
        <span className="sr-only">{ok === null ? 'unknown' : ok ? 'healthy' : 'failing'}</span>
      </span>
      <span className="tnum truncate font-mono text-[13px] text-ink-2">{detail}</span>
    </li>
  )
}

function StatusPanel({ data, pending, fetching, error, onRecheck }: { data: ServiceStatus | undefined; pending: boolean; fetching: boolean; error: string | null; onRecheck: () => void }) {
  const ms = (probe: { ok: boolean; ms: number }) => (probe.ok ? `${probe.ms} ms` : `failed · ${probe.ms} ms`)
  return (
    <section aria-label="Service health" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <SectionIndex n="03">Health</SectionIndex>
        <Button variant="ghost" size="sm" icon={<IconRefresh size={15} />} loading={fetching} onClick={onRecheck}>
          Recheck
        </Button>
      </div>
      {pending ? (
        <Skeleton className="h-[220px] w-full rounded-lg" />
      ) : !data ? (
        <EmptyState tone="pending" icon={<IconAlert size={20} />} title="Health check failed" body={error ?? 'No answer from /api/status.'} />
      ) : (
        <>
          <ul className="flex flex-col gap-px overflow-hidden rounded-lg border border-line bg-line">
            {data.rpc.map((node) => (
              <StatusLine key={node.name} label={`RPC ${node.name}`} ok={node.ok} detail={node.ok && node.block ? `${ms(node)} · #${node.block.toLocaleString('en-US')}` : ms(node)} />
            ))}
            <StatusLine label="Database" ok={data.db.ok} detail={ms(data.db)} />
            <StatusLine label="AI" ok={data.ai.ok} detail={`${data.ai.model ?? 'not configured'} · ${ms(data.ai)}`} />
            <StatusLine label="Journal" ok={data.contracts.journal ? true : null} detail={shortHex(data.contracts.journal)} />
            <StatusLine label="Breach report" ok={data.contracts.breach ? true : null} detail={shortHex(data.contracts.breach)} />
            <StatusLine label="Registry" ok={data.contracts.registry ? true : null} detail={shortHex(data.contracts.registry)} />
          </ul>
          {data.configProblems.length ? (
            <p role="status" className="rounded-md border border-pending/30 bg-pending-bg px-4 py-3 font-mono text-[12px] text-pending">
              Config: {data.configProblems.join(', ')}
            </p>
          ) : null}
        </>
      )}
    </section>
  )
}

// ---- console ------------------------------------------------------------------------------------

function Console({ token }: { token: string }) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [busy, setBusy] = useState<{ id: string; action: TamperAction } | null>(null)

  const receipts = useQuery({
    queryKey: ['operator', 'receipts'],
    queryFn: () => getDemoReceipts(token),
    refetchInterval: RECEIPTS_MS,
    retry: false,
  })
  const watch = useQuery({
    queryKey: ['operator', 'watch'],
    queryFn: getWatchSummary,
    refetchInterval: WATCH_MS,
    refetchIntervalInBackground: false,
    retry: false,
  })
  const status = useQuery({
    queryKey: ['operator', 'status'],
    queryFn: () => getServiceStatus(token),
    refetchInterval: STATUS_MS,
    retry: false,
  })

  // A rotated or wrong token: forget it and go back to the gate.
  const lostToken = rejected(receipts.error) || rejected(status.error)
  useEffect(() => {
    if (!lostToken) return
    writeToken(null)
    queryClient.removeQueries({ queryKey: ['operator'] })
    toast('The demo token was rejected. Paste it again.', 'bad')
  }, [lostToken, queryClient, toast])

  const tamper = useMutation({
    mutationFn: ({ id, action }: { id: string; action: TamperAction }) => tamperReceipt(token, action, id),
    onMutate: (vars) => setBusy(vars),
    onSuccess: (_, { id, action }) => toast(`${refOf(id)} ${DONE[action]}`),
    onError: (error) => {
      if (rejected(error)) writeToken(null)
      toast(messageOf(error), 'bad')
    },
    onSettled: async () => {
      setBusy(null)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['operator', 'receipts'] }),
        queryClient.invalidateQueries({ queryKey: ['operator', 'watch'] }),
      ])
    },
  })

  const rows = receipts.data ?? []
  const changed = rows.filter((row) => row.state !== 'intact').length

  return (
    <div className="grid gap-8 xl:grid-cols-12">
      <section aria-label="Recent receipts" aria-busy={receipts.isPending} className="flex min-w-0 flex-col gap-3 xl:col-span-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionIndex n="01">Receipts · newest first</SectionIndex>
          <div className="flex items-center gap-2">
            {changed ? <span className="label text-[12px] text-bad">{changed} tampered</span> : null}
            <Button variant="ghost" size="sm" icon={<IconRefresh size={15} />} loading={receipts.isFetching && !receipts.isPending} onClick={() => void receipts.refetch()}>
              Refresh
            </Button>
          </div>
        </div>
        {receipts.isPending ? (
          <div className="flex flex-col gap-px overflow-hidden rounded-lg border border-line bg-line" aria-label="Loading receipts">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex flex-col gap-3 bg-card p-5">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-64" />
                <Skeleton className="h-14 w-full" />
              </div>
            ))}
          </div>
        ) : receipts.isError && !receipts.data ? (
          <EmptyState
            tone="pending"
            icon={<IconAlert size={20} />}
            title="Could not load receipts"
            body={messageOf(receipts.error)}
            action={
              <Button variant="light" size="sm" icon={<IconRefresh size={15} />} onClick={() => void receipts.refetch()}>
                Try again
              </Button>
            }
          />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<IconReceipt size={20} />}
            title="No anchored receipts yet"
            body="Record a SHARED WITH THIRD PARTY access on /controller first. It appears here once it is sealed on chain."
          />
        ) : (
          <ul className="overflow-hidden rounded-lg border border-line bg-card">
            {rows.map((row) => (
              <ReceiptRow
                key={row.id}
                row={row}
                verdict={watch.data?.verdicts.get(watchKey(row.txHash, row.logIndex))}
                watchReady={Boolean(watch.data)}
                busy={busy?.id === row.id ? busy.action : null}
                locked={busy !== null}
                onAction={(action) => tamper.mutate({ id: row.id, action })}
              />
            ))}
          </ul>
        )}
      </section>

      <aside className="flex flex-col gap-8 xl:col-span-4">
        <WatchSummaryPanel data={watch.data} error={watch.isError} updatedAt={watch.dataUpdatedAt} />
        <StatusPanel
          data={status.data}
          pending={status.isPending}
          fetching={status.isFetching && !status.isPending}
          error={status.error ? messageOf(status.error) : null}
          onRecheck={() => void status.refetch()}
        />
      </aside>
    </div>
  )
}

/** Presenter console for the live demo: tamper a sealed receipt in the database and watch Saksi catch it. */
export function OperatorConsole() {
  const token = useToken()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const lock = () => {
    writeToken(null)
    queryClient.removeQueries({ queryKey: ['operator'] })
    toast('Console locked', 'info')
  }
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <TwoTone head="Presenter console." tail="Change the database. The chain remembers." className="text-[34px] md:text-[48px]" />
          <ol className="mt-4 flex flex-col gap-1.5 text-[15px] text-ink-2 md:flex-row md:gap-6">
            <li>
              <span className="font-mono text-blue">01</span> Open the receipt on the phone
            </li>
            <li>
              <span className="font-mono text-blue">02</span> Edit or delete it here
            </li>
            <li>
              <span className="font-mono text-blue">03</span> Watch flips within 3 s · Restore after
            </li>
          </ol>
        </div>
        {token ? (
          <Button variant="light" size="sm" icon={<IconMinus size={15} />} onClick={lock}>
            Lock console
          </Button>
        ) : null}
      </div>
      {token ? <Console token={token} /> : <TokenGate />}
    </div>
  )
}
