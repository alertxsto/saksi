'use client'

import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { TechProof, TxLink } from '@/components/controller/AgencyKit'
import { IconAlert, IconCheck, IconLock, IconPen, IconPhone, IconRefresh, IconTrash, IconUndo } from '@/components/controller/agency-icons'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import type { DemoReceipt, ServiceStatus, TamperAction, TamperReport, WatchSummary } from '@/lib/data'
import { formatWIB, shortHex, timeAgo } from '@/lib/format'
import { useNow } from '@/lib/hooks'
import type { WatchRow } from '@/lib/shared/types'
import '@/app/controller/agency.css'

export const refOf = (id: string) => `R.${id.replace(/-/g, '').slice(0, 8).toUpperCase()}`
const ACTION_NAME = ['Read', 'Update', 'Export', 'Shared with third party'] as const

const DB_STATE: Record<DemoReceipt['state'], { text: string; cls: string }> = {
  intact: { text: 'As sealed', cls: 'bg-paper-2 text-ink-2' },
  edited: { text: 'Edited', cls: 'bg-bad-bg text-bad' },
  deleted: { text: 'Deleted', cls: 'bg-bad-bg text-bad' },
}
const WATCH_WORD: Record<WatchRow['status'], { text: string; cls: string }> = {
  MATCH: { text: 'Matches the sealed record', cls: 'text-ok' },
  ALTERED: { text: 'Changed after sealing', cls: 'text-bad' },
  DELETED: { text: 'Deleted by the agency', cls: 'text-bad' },
  NOT_ANCHORED: { text: 'Not sealed yet', cls: 'text-pending' },
}

// ---- token gate ------------------------------------------------------------------------------------

/** The unlock form. `onUnlock` checks the token with the server and stores it; this only renders. */
export function TokenGateView({ onUnlock }: { onUnlock: (token: string) => Promise<string | null> }) {
  const id = useId()
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const candidate = value.trim()
    if (!candidate) return setError('Paste the admin token first.')
    setChecking(true)
    setError(null)
    const problem = await onUnlock(candidate)
    setChecking(false)
    if (problem) setError(problem)
    else setValue('')
  }

  return (
    <form onSubmit={onSubmit} noValidate className="ag-group mx-auto flex w-full max-w-[520px] flex-col gap-5 p-6">
      <div className="flex items-start gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-[12px] bg-pending-bg text-pending">
          <IconLock size={22} />
        </span>
        <div>
          <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-ink">Unlock the evidence room</h2>
          <p className="mt-1 text-[15px] leading-relaxed text-ink-2">For the presenter only. The token stays in this tab and is forgotten when the tab closes.</p>
        </div>
      </div>
      <div>
        <label htmlFor={id} className="mb-2 block text-[14px] font-medium text-ink">
          Admin token
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
          className="ag-input h-14 font-mono text-[17px]"
          placeholder="Admin token"
        />
        <p id={`${id}-h`} role={error ? 'alert' : undefined} className={`mt-2 text-[13px] ${error ? 'text-bad' : 'text-ink-2'}`}>
          {error ?? 'Sent only in a request header, never in the address bar.'}
        </p>
      </div>
      <Button type="submit" size="lg" arrow loading={checking} full>
        Unlock
      </Button>
    </form>
  )
}

// ---- record list -----------------------------------------------------------------------------------

function RecordList({
  rows,
  selected,
  verdictOf,
  onSelect,
}: {
  rows: DemoReceipt[]
  selected: string | null
  verdictOf: (row: DemoReceipt) => WatchRow['status'] | undefined
  onSelect: (id: string) => void
}) {
  const now = useNow()
  return (
    <div role="radiogroup" aria-label="Sealed records" className="ag-group flex flex-col overflow-hidden p-1.5">
      {rows.map((row) => {
        const on = row.id === selected
        const db = DB_STATE[row.state]
        const verdict = verdictOf(row)
        return (
          <button
            key={row.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onSelect(row.id)}
            className="ag-pick flex w-full items-center gap-3 rounded-[12px] px-3.5 py-3 text-left"
          >
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="font-mono text-[14px] font-semibold text-ink">{refOf(row.id)}</span>
                <span className={`inline-flex h-6 items-center rounded-pill px-2 text-[12px] font-medium ${db.cls}`}>{db.text}</span>
              </span>
              <span className="mt-0.5 block truncate text-[14px] text-ink">{row.controllerName}</span>
              <span className="block truncate text-[13px] text-ink-2">
                {ACTION_NAME[row.eventType]} · {now ? timeAgo(row.createdAt, now) : '—'}
              </span>
            </span>
            {verdict ? (
              <span className={`shrink-0 text-right text-[12px] leading-tight ${WATCH_WORD[verdict].cls}`}>
                {verdict === 'MATCH' ? <IconCheck size={16} strokeWidth={2.4} /> : <IconAlert size={16} />}
                <span className="sr-only">{WATCH_WORD[verdict].text}</span>
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

// ---- evidence ---------------------------------------------------------------------------------------

const SQL_KEYWORDS = /\b(with|as|update|set|where|and|returning|insert|into|select|from|delete|values)\b/gi

/** The statement Postgres received, keywords tinted; values stay parameterised. */
function Sql({ text }: { text: string }) {
  const parts = text.split(SQL_KEYWORDS)
  return (
    <pre className="ag-sql max-w-full overflow-x-auto whitespace-pre-wrap px-4 py-3.5 font-mono text-[13px] leading-[1.65] [overflow-wrap:anywhere]">
      {parts.map((p, i) => (i % 2 ? <span key={i} className="k">{p}</span> : p))}
    </pre>
  )
}

function Verdict({ action }: { action: TamperAction }) {
  const restore = action === 'restore'
  return (
    <div
      key={action}
      role="status"
      className={`${restore ? 'ag-verdict bg-ok-bg' : 'ag-verdict-bad bg-bad-bg'} flex items-start gap-4 rounded-[16px] p-5 md:p-6`}
    >
      <span className={`flex size-12 shrink-0 items-center justify-center rounded-[12px] ${restore ? 'bg-ok text-white' : 'bg-bad text-white'}`}>
        <IconPhone size={24} />
      </span>
      <div className="min-w-0">
        <p className={`text-[24px] font-semibold leading-tight tracking-[-0.02em] md:text-[28px] ${restore ? 'text-ok' : 'text-bad'}`}>
          {restore ? 'The citizen’s phone will show “Matches” again within ~3 s' : 'The citizen’s phone will turn red within ~3 s'}
        </p>
        <p className="mt-1.5 text-[15px] leading-relaxed text-ink">
          {restore
            ? 'The row is back exactly as it was sealed, so the phone’s check agrees with the public ledger again.'
            : action === 'delete'
              ? 'The row is gone from the agency’s database, but the public ledger still holds the sealed receipt. The phone shows “Deleted by the agency”.'
              : 'The database now says a different action than the one sealed on the public ledger. The phone shows “Changed after sealing”.'}
        </p>
      </div>
    </div>
  )
}

function Step({ n, title, children, hint }: { n: number; title: string; hint?: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-3">
      <div className="flex items-baseline gap-2.5">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-ink text-[12px] font-semibold text-paper tnum">{n}</span>
        <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
        {hint ? <span className="text-[13px] text-ink-3">{hint}</span> : null}
      </div>
      {children}
    </section>
  )
}

type Choice = { action: TamperAction; label: string; sub: string; icon: ReactNode; enabled: boolean; danger?: boolean }

/**
 * The selected record: choose Edit / Delete / Restore, run it, then see the SQL, before → after, and the verdict.
 * Delete keeps its confirmation: choosing it arms a separate "Yes, delete the row" button.
 */
export function EvidencePanel({
  row,
  report,
  busy,
  locked,
  onAction,
}: {
  row: DemoReceipt
  report: TamperReport | null
  busy: TamperAction | null
  locked: boolean
  onAction: (action: TamperAction) => void
}) {
  const now = useNow()
  const choices: Choice[] = [
    { action: 'edit', label: 'Edit', sub: row.eventType === 0 ? 'Change the action to Shared' : 'Change the action to Read', icon: <IconPen size={20} />, enabled: row.editable },
    { action: 'delete', label: 'Delete', sub: 'Remove the row from the database', icon: <IconTrash size={20} />, enabled: row.state !== 'deleted', danger: true },
    { action: 'restore', label: 'Restore', sub: 'Put it back exactly as sealed', icon: <IconUndo size={20} />, enabled: row.restorable },
  ]
  // A tampered row offers Restore first; an intact one offers the first safe action that applies (never Delete).
  const firstEnabled = row.state !== 'intact' && row.restorable ? 'restore' : (choices.find((c) => c.enabled && !c.danger)?.action ?? 'edit')
  const [pick, setPick] = useState<TamperAction>(firstEnabled)
  // A new record or a state change (edit → deleted…) re-picks the first action that still applies.
  const sig = `${row.id}:${row.state}:${row.editable}:${row.restorable}`
  const last = useRef(sig)
  useEffect(() => {
    if (last.current === sig) return
    last.current = sig
    setPick(firstEnabled)
  }, [sig, firstEnabled])
  // Once a run settles, disarm: a stray second click must not delete the next row.
  const wasBusy = useRef(busy)
  useEffect(() => {
    if (wasBusy.current && !busy) setPick(firstEnabled)
    wasBusy.current = busy
  }, [busy, firstEnabled])
  const current = choices.find((c) => c.action === pick) ?? choices[0]
  const mine = report && report.eventId === row.id ? report : null

  return (
    <div className="flex min-w-0 flex-col gap-7">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[13px] text-ink-2">{refOf(row.id)}</p>
          <h2 className="mt-0.5 text-[24px] font-semibold leading-tight tracking-[-0.02em] text-ink">{row.controllerName}</h2>
          <p className="mt-1 text-[15px] text-ink-2">
            {ACTION_NAME[row.eventType]} · sealed {formatWIB(row.createdAt)}
            {now ? ` · ${timeAgo(row.createdAt, now)}` : ''}
          </p>
        </div>
        <span className={`inline-flex h-8 items-center rounded-pill px-3 text-[14px] font-medium ${DB_STATE[row.state].cls}`}>Database · {DB_STATE[row.state].text}</span>
      </header>

      <Step n={1} title="Choose what to do to the database">
        <div role="radiogroup" aria-label="Action" className="grid gap-2 sm:grid-cols-3">
          {choices.map((c) => {
            const on = c.action === pick
            return (
              <button
                key={c.action}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={!c.enabled || locked}
                onClick={() => setPick(c.action)}
                className={`ag-pick flex flex-col items-start gap-2 rounded-[14px] p-4 text-left disabled:cursor-not-allowed disabled:opacity-40 ${
                  on ? '' : 'bg-card shadow-[0_0_0_1px_var(--color-line)]'
                }`}
              >
                <span className={c.danger ? 'text-bad' : 'text-ink'}>{c.icon}</span>
                <span className="text-[17px] font-semibold text-ink">{c.label}</span>
                <span className="text-[13px] leading-snug text-ink-2">{c.sub}</span>
              </button>
            )
          })}
        </div>
        <Button
          variant={current.danger ? 'danger' : current.action === 'restore' ? 'blue' : 'dark'}
          size="lg"
          full
          icon={current.action === 'restore' ? <IconRefresh size={18} /> : current.action === 'delete' ? <IconTrash size={18} /> : <IconPen size={18} />}
          loading={busy === current.action}
          disabled={locked || !current.enabled}
          onClick={() => onAction(current.action)}
        >
          {current.action === 'delete' ? `Yes, delete ${refOf(row.id)} from the database` : current.action === 'edit' ? `Run the edit on ${refOf(row.id)}` : `Restore ${refOf(row.id)}`}
        </Button>
        <p className="text-[13px] text-ink-2">Only the agency’s database changes. The public ledger is never touched.</p>
      </Step>

      {mine ? (
        <>
          <Verdict action={mine.action} />
          <Step n={2} title="The statement that ran" hint={`tamper_log ${mine.log.id.slice(0, 8)}`}>
            <Sql text={mine.statement} />
            <p className="font-mono text-[12px] text-ink-2 [overflow-wrap:anywhere]">
              {mine.params.map((p) => `${p.name} = ${p.value}`).join('  ·  ')}
              <span className="text-ink-3">  ·  row snapshot withheld</span>
            </p>
          </Step>
          <Step n={3} title="Before → after">
            <dl className="ag-group overflow-hidden">
              {mine.changes.map((c, i) => (
                <div key={c.field} className={`grid min-w-0 gap-2 px-5 py-4 sm:grid-cols-[140px_1fr_auto_1fr] sm:items-center ${i ? 'border-t border-line/70' : ''}`}>
                  <dt className="font-mono text-[13px] text-ink-2">{c.field}</dt>
                  <dd className="text-[16px] text-ink-2 line-through decoration-bad/70 decoration-[1.5px]">{c.before}</dd>
                  <dd aria-hidden="true" className="hidden text-ink-3 sm:block">→</dd>
                  <dd className="text-[16px] font-semibold text-ink">
                    <span className="sr-only">changed to </span>
                    {c.after}
                  </dd>
                </div>
              ))}
            </dl>
          </Step>
          <TechProof
            rows={[
              ['Row hash before', mine.rowHash.before ? shortHex(mine.rowHash.before, 10, 8) : 'no row'],
              ['Row hash after', mine.rowHash.after ? shortHex(mine.rowHash.after, 10, 8) : 'no row'],
              ['Logged at', new Date(mine.log.at).toISOString().replace('T', ' ').slice(0, 19) + ' UTC'],
              ['Sealed transaction', row.txHash ? <TxLink hash={row.txHash} /> : null],
            ]}
          />
        </>
      ) : (
        <div className="flex items-start gap-3 rounded-[16px] border border-dashed border-line-strong px-5 py-4 text-[14px] leading-relaxed text-ink-2">
          <IconPhone size={20} className="mt-0.5 shrink-0 text-ink-3" />
          Open this receipt on the citizen’s phone first, then run an action. The statement, the before → after and the verdict appear here.
        </div>
      )}
    </div>
  )
}

// ---- side: what Saksi sees + health ------------------------------------------------------------------

export function WatchCounts({ data, error }: { data: WatchSummary | undefined; error: boolean }) {
  const v = (n: number | undefined) => (data ? (n ?? 0).toLocaleString('en-US') : '–')
  const cells: Array<[string, number | undefined, string]> = [
    ['Match the sealed record', data?.stats.MATCH, 'text-ink'],
    ['Changed after sealing', data?.stats.ALTERED, (data?.stats.ALTERED ?? 0) > 0 ? 'text-bad' : 'text-ink'],
    ['Deleted by the agency', data?.stats.DELETED, (data?.stats.DELETED ?? 0) > 0 ? 'text-bad' : 'text-ink'],
    ['Not sealed yet', data?.stats.NOT_ANCHORED, 'text-ink'],
  ]
  return (
    <section aria-label="What Saksi sees" className="ag-group p-5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[15px] font-semibold text-ink">What Saksi sees</h2>
        <span className="text-[13px] text-ink-3">{error ? 'Ledger slow to answer' : data ? 'Checked just now' : 'Checking…'}</span>
      </div>
      <dl className="mt-3 flex flex-col">
        {cells.map(([k, n, cls], i) => (
          <div key={k} className={`flex items-center justify-between gap-3 py-2.5 ${i ? 'border-t border-line/70' : ''}`}>
            <dt className="text-[14px] text-ink-2">{k}</dt>
            <dd className={`text-[20px] font-semibold tnum ${cls}`}>{v(n)}</dd>
          </div>
        ))}
      </dl>
      <ButtonLink href="/regulator/watch" external variant="light" size="md" arrow full className="mt-3">
        Open the regulator’s view
      </ButtonLink>
    </section>
  )
}

export function HealthDisclosure({
  data,
  pending,
  fetching,
  error,
  onRecheck,
}: {
  data: ServiceStatus | undefined
  pending: boolean
  fetching: boolean
  error: string | null
  onRecheck: () => void
}) {
  const ms = (probe: { ok: boolean; ms: number }) => (probe.ok ? `${probe.ms} ms` : `failed · ${probe.ms} ms`)
  const lines: Array<[string, boolean | null, string]> = data
    ? [
        ...data.rpc.map((n): [string, boolean | null, string] => [`Ledger node ${n.name}`, n.ok, ms(n)]),
        ['Database', data.db.ok, ms(data.db)],
        ['AI', data.ai.ok, `${data.ai.model ?? 'not configured'} · ${ms(data.ai)}`],
        ['Journal contract', data.contracts.journal ? true : null, shortHex(data.contracts.journal)],
        ['Breach contract', data.contracts.breach ? true : null, shortHex(data.contracts.breach)],
        ['Registry contract', data.contracts.registry ? true : null, shortHex(data.contracts.registry)],
      ]
    : []
  const bad = lines.filter(([, ok]) => ok === false).length
  return (
    <details className="ag-proof ag-group group p-5">
      <summary className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2.5 text-[15px] font-semibold text-ink">
          <span aria-hidden="true" className={`size-2 rounded-full ${pending ? 'bg-ink-3' : !data || bad ? 'bg-pending' : 'bg-ok'}`} />
          System health
        </span>
        <span className="text-[13px] text-ink-2">{pending ? 'Checking…' : !data ? 'No answer' : bad ? `${bad} need attention` : 'All good'}</span>
      </summary>
      <div className="mt-4 flex flex-col gap-3">
        {pending ? (
          <Skeleton className="h-[180px] w-full rounded-[12px]" />
        ) : !data ? (
          <p className="text-[14px] text-pending">{error ?? 'No answer from /api/status.'}</p>
        ) : (
          <ul className="flex flex-col">
            {lines.map(([k, ok, d], i) => (
              <li key={k} className={`flex items-center justify-between gap-3 py-2 ${i ? 'border-t border-line/70' : ''}`}>
                <span className="flex items-center gap-2 text-[13px] text-ink">
                  <span aria-hidden="true" className={`size-2 rounded-full ${ok === null ? 'bg-ink-3' : ok ? 'bg-ok' : 'bg-pending'}`} />
                  {k}
                  <span className="sr-only">{ok === null ? 'unknown' : ok ? 'healthy' : 'failing'}</span>
                </span>
                <span className="truncate font-mono text-[12px] text-ink-2">{d}</span>
              </li>
            ))}
          </ul>
        )}
        {data?.configProblems.length ? <p className="rounded-[12px] bg-pending-bg px-3.5 py-2.5 font-mono text-[12px] text-pending">Config: {data.configProblems.join(', ')}</p> : null}
        <Button variant="ghost" size="sm" icon={<IconRefresh size={15} />} loading={fetching} onClick={onRecheck} className="self-start">
          Check again
        </Button>
      </div>
    </details>
  )
}

// ---- the room ---------------------------------------------------------------------------------------

export type RoomData = {
  rows: DemoReceipt[]
  rowsState: 'loading' | 'error' | 'ready'
  rowsError?: string
  refreshing?: boolean
  watch: WatchSummary | undefined
  watchError: boolean
  status: ServiceStatus | undefined
  statusPending: boolean
  statusFetching: boolean
  statusError: string | null
  report: TamperReport | null
  busy: { id: string; action: TamperAction } | null
}

/** Presentational evidence room (the console container and the dev gallery both render this). */
export function OperatorRoomView({
  data,
  verdictOf,
  onAction,
  onRefresh,
  onRecheck,
}: {
  data: RoomData
  verdictOf: (row: DemoReceipt) => WatchRow['status'] | undefined
  onAction: (id: string, action: TamperAction) => void
  onRefresh: () => void
  onRecheck: () => void
}) {
  const { rows } = data
  const [selected, setSelected] = useState<string | null>(null)
  const sel = rows.find((r) => r.id === selected) ?? rows[0] ?? null
  const changed = rows.filter((r) => r.state !== 'intact').length
  const panelRef = useRef<HTMLDivElement>(null)
  const select = (id: string) => {
    setSelected(id)
    if (window.matchMedia('(max-width: 1023px)').matches) requestAnimationFrame(() => panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)] lg:gap-8">
      <div className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[15px] font-semibold text-ink">
            Sealed records {changed ? <span className="font-normal text-bad">· {changed} changed</span> : null}
          </h2>
          <Button variant="ghost" size="sm" icon={<IconRefresh size={15} />} loading={data.refreshing} onClick={onRefresh}>
            Refresh
          </Button>
        </div>
        {data.rowsState === 'loading' ? (
          <div className="ag-group flex flex-col gap-1 p-1.5" aria-label="Loading records">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex flex-col gap-2 px-3.5 py-3">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-48" />
              </div>
            ))}
          </div>
        ) : data.rowsState === 'error' ? (
          <div className="ag-group flex flex-col items-start gap-3 p-5">
            <p className="text-[15px] font-semibold text-ink">Could not load the records</p>
            <p className="text-[14px] text-ink-2">{data.rowsError ?? 'Check the server and try again.'}</p>
            <Button variant="light" size="sm" icon={<IconRefresh size={15} />} onClick={onRefresh}>
              Try again
            </Button>
          </div>
        ) : rows.length === 0 ? (
          <div className="ag-group flex flex-col gap-1.5 p-5">
            <p className="text-[15px] font-semibold text-ink">No sealed records yet</p>
            <p className="text-[14px] leading-relaxed text-ink-2">Record a lookup in the agency system first. It appears here once it is sealed on the public ledger.</p>
          </div>
        ) : (
          <RecordList rows={rows} selected={sel?.id ?? null} verdictOf={verdictOf} onSelect={select} />
        )}
        <div className="hidden flex-col gap-4 lg:flex">
          <WatchCounts data={data.watch} error={data.watchError} />
          <HealthDisclosure data={data.status} pending={data.statusPending} fetching={data.statusFetching} error={data.statusError} onRecheck={onRecheck} />
        </div>
      </div>

      <div ref={panelRef} className="min-w-0 scroll-mt-20">
        {sel ? (
          <div className="ag-group p-5 md:p-7">
            <EvidencePanel
              key={sel.id}
              row={sel}
              report={data.report}
              busy={data.busy?.id === sel.id ? data.busy.action : null}
              locked={data.busy !== null}
              onAction={(action) => onAction(sel.id, action)}
            />
          </div>
        ) : data.rowsState === 'ready' ? null : (
          <Skeleton className="h-[480px] w-full rounded-[16px]" />
        )}
        <div className="mt-6 flex flex-col gap-4 lg:hidden">
          <WatchCounts data={data.watch} error={data.watchError} />
          <HealthDisclosure data={data.status} pending={data.statusPending} fetching={data.statusFetching} error={data.statusError} onRecheck={onRecheck} />
        </div>
      </div>
    </div>
  )
}

/** The three moves of the demo, one line. */
export function RoomSteps() {
  const items = ['Open the receipt on the citizen’s phone', 'Change it here', 'Watch the phone turn red, then Restore']
  return (
    <ol className="flex flex-col gap-2 text-[14px] text-ink-2 md:flex-row md:flex-wrap md:gap-x-6">
      {items.map((t, i) => (
        <li key={t} className="flex items-center gap-2">
          <span className="flex size-5 items-center justify-center rounded-full bg-paper-2 text-[12px] font-semibold text-ink tnum">{i + 1}</span>
          {t}
        </li>
      ))}
    </ol>
  )
}
