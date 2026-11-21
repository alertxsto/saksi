'use client'

import { useQuery } from '@tanstack/react-query'
import { useId, useState } from 'react'
import type { Hex } from 'viem'
import { useAccount, useConnect, useSignMessage } from 'wagmi'
import { VerdictStamp } from '@/components/citizen/VerdictStamp'
import { Button } from '@/components/ui/Button'
import { IconArrowUpRight, IconCheck, IconRefresh, IconUser, IconWallet } from '@/components/ui/icons'
import { Skeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import { Sheet } from '@/components/regulator/Sheet'
import { ago, Calm, Fact, PageHeader, plainTime, ProofRow, sealedPhrase, TechnicalProof, useArrivals } from '@/components/regulator/Workspace'
import {
  getRegulatorReports,
  REPORT_REASON_LABEL,
  reviewMessage,
  reviewReport,
  type RegulatorReportsWire,
  type RegulatorReportWire,
  type ReportVerdict,
  type ReviewResult,
} from '@/lib/data'
import { explorerTx } from '@/lib/env'
import { shortHex } from '@/lib/format'
import { useNow } from '@/lib/hooks'
import { EVENT_LABELS } from '@/lib/shared/types'
import '../regulator.css'

const POLL_MS = 5000

/** The server's verdict in witness words. Red only for a record changed or deleted after sealing. */
const VERDICT: Record<ReportVerdict, { short: string; line: string; tone: 'ok' | 'bad' | 'muted' }> = {
  MATCH: { short: 'Matches', line: 'Matches the sealed record', tone: 'ok' },
  ALTERED: { short: 'Changed', line: 'Changed after sealing', tone: 'bad' },
  DELETED: { short: 'Deleted', line: 'Deleted by the agency, still on the public ledger', tone: 'bad' },
  NOT_FOUND: { short: 'Not found', line: 'Not on the public ledger yet, or the node did not answer', tone: 'muted' },
}
const PILL: Record<'ok' | 'bad' | 'muted', string> = {
  ok: 'text-ok',
  bad: 'bg-bad-bg text-bad border border-bad/25 px-2',
  muted: 'bg-paper-2 text-ink-2 border border-line px-2',
}
const short = (name: string) => name.replace(' (fictional)', '').replace(' (fiktif)', '')

type Sign = (message: string) => Promise<{ signature: Hex; address: string }>
type Review = (id: string, signedAt: string, signature: Hex) => Promise<ReviewResult>

/** Signs with the injected wallet (MetaMask), connecting it first if needed. A message signature: no transaction, no gas. */
function useWalletSigner(): Sign {
  const { address, isConnected } = useAccount()
  const { connectors, connectAsync } = useConnect({ mutation: { retry: false } })
  const { signMessageAsync } = useSignMessage({ mutation: { retry: false } })
  return async (message) => {
    let account = isConnected ? address : undefined
    if (!account) {
      const connector = connectors.find((c) => c.id === 'injected')
      if (!connector) throw new Error('No browser wallet found. Open this page where the registry admin wallet is installed.')
      account = (await connectAsync({ connector })).accounts[0]
    }
    if (!account) throw new Error('The wallet did not connect.')
    return { signature: await signMessageAsync({ account, message }), address: account }
  }
}

const errorText = (e: unknown) => {
  const m = e instanceof Error ? e.message : ''
  if (/reject|denied|cancel/i.test(m)) return 'You cancelled the signature. Nothing was changed.'
  return m.split('\n')[0] || 'Could not mark the report reviewed.'
}

function QueueSkeleton() {
  return (
    <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-lg border border-line bg-card" aria-busy="true" aria-label="Loading reports">
      {Array.from({ length: 5 }, (_, i) => (
        <li key={i} className="flex items-start gap-3 px-4 py-4">
          <Skeleton className="mt-1.5 size-2 rounded-full" />
          <span className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-4/5" />
          </span>
          <Skeleton className="h-5 w-16" />
        </li>
      ))}
    </ul>
  )
}

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-line bg-card p-6" aria-hidden="true">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-7 w-3/4" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  )
}

function VerdictPill({ v }: { v: ReportVerdict }) {
  const m = VERDICT[v]
  return (
    <span className={`inline-flex h-6 shrink-0 items-center gap-1 whitespace-nowrap rounded-pill text-[12px] font-medium ${PILL[m.tone]}`}>
      {m.tone === 'ok' ? <IconCheck size={12} strokeWidth={2.6} /> : null}
      {m.short}
    </span>
  )
}

/** One queue entry: agency + time on line one, the citizen's reason on line two, the server verdict on the right. */
function QueueRow({ r, selected, fresh, now, onSelect }: { r: RegulatorReportWire; selected: boolean; fresh: boolean; now: number; onSelect: (id: string) => void }) {
  const open = r.status === 'open'
  return (
    <li className={fresh ? 'rg2-new' : ''}>
      <button
        type="button"
        onClick={() => onSelect(r.id)}
        aria-current={selected ? 'true' : undefined}
        className="rg2-entry relative flex w-full items-start gap-3 px-4 py-3.5 text-left"
      >
        <span aria-hidden="true" className={`mt-[7px] size-2 shrink-0 rounded-full ${open ? 'bg-blue' : 'bg-line-strong'}`} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-baseline justify-between gap-3">
            <span className={`truncate text-[15px] ${open ? 'font-medium text-ink' : 'text-ink-2'}`}>{short(r.controllerName)}</span>
            <span className="shrink-0 text-[12px] text-ink-3">{now ? ago(r.createdAt, now) : ''}</span>
          </span>
          <span className="flex items-center justify-between gap-3">
            <span className="truncate text-[13px] text-ink-2">{REPORT_REASON_LABEL[r.reason]}</span>
            <VerdictPill v={r.serverVerdict} />
          </span>
        </span>
      </button>
    </li>
  )
}

/**
 * The report as a ticket: the agency and the citizen's reason on top, the server's verdict stamped on it,
 * the sealed record facts under the perforation, then the signed review. Keyed by id so the stamp lands
 * each time a report opens.
 */
function ReportDetail({
  r,
  admin,
  busy,
  error,
  now,
  onMarkReviewed,
}: {
  r: RegulatorReportWire
  admin: string | null
  busy: boolean
  error?: string
  now: number
  onMarkReviewed: (id: string) => void
}) {
  const open = r.status === 'open'
  const v = VERDICT[r.serverVerdict]
  const stamp = r.serverVerdict === 'MATCH' ? 'ok' : r.serverVerdict === 'ALTERED' ? 'bad' : null
  return (
    <article className="rg2-swap flex flex-col gap-5" aria-label={`Report about ${short(r.controllerName)}`}>
      <div className={r.serverVerdict === 'ALTERED' || r.serverVerdict === 'DELETED' ? 'st-shadow-bad' : 'st-shadow'}>
        <div className="st-half-top relative rounded-t-lg bg-card px-5 pb-6 pt-5 lg:px-6">
          <p className="flex items-center gap-2 text-[13px] text-ink-3">
            <span aria-hidden="true" className={`size-2 rounded-full ${open ? 'bg-blue' : 'bg-line-strong'}`} />
            {open ? `Open · reported ${now ? ago(r.createdAt, now) : plainTime(r.createdAt)}` : 'Reviewed'}
          </p>
          <div className="mt-3 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[14px] text-ink-2">
                Citizen <span className="font-mono text-[13px] text-ink">{r.citizenMasked}</span> reported
              </p>
              <h2 className="mt-1 text-balance text-[24px] font-semibold leading-[1.15] tracking-[-0.02em] text-ink lg:text-[26px]">
                {short(r.controllerName)}
              </h2>
              <p className="mt-2 text-[16px] leading-snug text-ink">{REPORT_REASON_LABEL[r.reason]}</p>
            </div>
            {stamp ? (
              <div aria-hidden="true" className="-mr-1 -mt-1">
                <VerdictStamp kind={stamp} size={104} />
              </div>
            ) : null}
          </div>
          {r.note ? (
            <blockquote className="mt-4 rounded-md bg-paper-2/70 px-4 py-3 text-[15px] leading-relaxed text-ink-2">“{r.note}”</blockquote>
          ) : null}
          <p className={`mt-4 text-[14px] font-medium ${v.tone === 'bad' ? 'text-bad' : v.tone === 'ok' ? 'text-ok' : 'text-ink-2'}`}>
            {v.line}
          </p>
          <p className="mt-0.5 text-[13px] text-ink-3">Saksi’s server re-checked this receipt against the public ledger when the report arrived.</p>
          <span aria-hidden="true" className="st-perf absolute inset-x-4 bottom-0 text-line-strong" />
        </div>
        <div className="st-half-bottom rounded-b-lg bg-card px-5 pb-2 pt-3 lg:px-6">
          <dl>
            <Fact k="Agency">{r.controllerName}</Fact>
            <Fact k="Citizen">
              <span className="font-mono text-[14px]">{r.citizenMasked}</span> <span className="text-ink-3">· masked</span>
            </Fact>
            <Fact k="What they did">{EVENT_LABELS[r.eventType]}</Fact>
            <Fact k="Sealed record">{sealedPhrase(r.sealedAt)}</Fact>
            <Fact k="Server verdict" tone={v.tone === 'bad' ? 'bad' : v.tone === 'ok' ? 'ok' : undefined}>
              {v.line}
            </Fact>
            <Fact k="Legal grounding">UU PDP Pasal 32 · the processing record a citizen may ask for</Fact>
          </dl>
          <TechnicalProof>
            <ProofRow k="Transaction">
              {r.txHash ? (
                <a href={explorerTx(r.txHash)} target="_blank" rel="noreferrer" className="inline-flex min-h-8 items-center gap-1 hover:text-blue">
                  {shortHex(r.txHash, 8, 6)} <IconArrowUpRight size={12} />
                </a>
              ) : (
                'None'
              )}
            </ProofRow>
            <ProofRow k="Log index">{r.logIndex ?? 'None'}</ProofRow>
            {r.sealedAt ? <ProofRow k="Block time">{new Date(r.sealedAt * 1000).toISOString().replace('.000', '')}</ProofRow> : null}
            <ProofRow k="Report id">{r.id.slice(0, 8)}</ProofRow>
          </TechnicalProof>
        </div>
      </div>

      <section aria-label="Review" className="rounded-lg border border-line bg-card px-5 py-4 lg:px-6">
        {open ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-[44ch] text-[13px] leading-relaxed text-ink-2">
              Signed with the registry admin wallet
              {admin ? <span className="font-mono text-[12px] text-ink"> {shortHex(admin, 6, 4)}</span> : null}. A message signature: no
              transaction, no gas.
            </p>
            <Button variant="dark" size="sm" loading={busy} disabled={busy} icon={<IconWallet size={15} />} onClick={() => onMarkReviewed(r.id)}>
              {busy ? 'Waiting for signature' : 'Mark reviewed'}
            </Button>
          </div>
        ) : (
          <p className="flex items-start gap-2.5 text-[14px] text-ink">
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-[#157f3d] text-white">
              <IconCheck size={12} strokeWidth={3} />
            </span>
            <span>
              Reviewed{r.reviewedAt ? ` · ${plainTime(r.reviewedAt)}` : ''}
              <span className="block text-[13px] text-ink-3">
                Signed by the registry admin{r.reviewedBy ? <span className="font-mono text-[12px]"> {shortHex(r.reviewedBy, 6, 4)}</span> : null}
              </span>
            </span>
          </p>
        )}
        {error ? (
          <p role="alert" className="mt-3 border-t border-line pt-3 text-[14px] text-ink">
            {error}
          </p>
        ) : null}
      </section>
    </article>
  )
}

/**
 * Citizen reports: the queue on the left, the report on the right (from 1024); a bottom sheet on phones.
 * Each verdict was computed by the server against the chain when the report arrived. Marking a report
 * reviewed asks the ControllerRegistry admin wallet for a message signature.
 * `load` / `sign` / `review` come from the /dev gallery; the app uses the real API and the injected wallet.
 */
export function ReportsQueue({
  load,
  sign,
  review,
  pollMs,
}: {
  load?: () => Promise<RegulatorReportsWire>
  sign?: Sign
  review?: Review
  /** Gallery only: poll the mock loader (to replay a report arriving). */
  pollMs?: number
}) {
  const instance = useId()
  const walletSign = useWalletSigner()
  const { toast } = useToast()
  const now = useNow() ?? 0
  const q = useQuery({
    queryKey: ['regulator-reports', load ? instance : 'live'],
    queryFn: load ?? getRegulatorReports,
    refetchInterval: load ? (pollMs ?? false) : POLL_MS,
    refetchIntervalInBackground: false,
    retry: false,
  })
  const [filter, setFilter] = useState<'open' | 'all'>('open')
  const [busy, setBusy] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [done, setDone] = useState<Record<string, ReviewResult>>({})
  const [sel, setSel] = useState<string | null>(null)
  const [sheet, setSheet] = useState(false)

  const data = q.data
  const reports = (data?.reports ?? []).map((r) => {
    const d = done[r.id]
    return d ? { ...r, status: d.status, reviewedAt: d.reviewedAt, reviewedBy: d.reviewedBy } : r
  })
  const shown = filter === 'open' ? reports.filter((r) => r.status === 'open') : reports
  const open = reports.filter((r) => r.status === 'open').length
  const admin = data?.admin ?? null
  const fresh = useArrivals(data ? data.reports.map((r) => r.id) : null)
  const current = reports.find((r) => r.id === sel) ?? shown[0]

  const onRetry = () => void q.refetch()
  const onSelect = (id: string) => {
    setSel(id)
    // From 1024 the report opens in the pane beside the queue; the sheet is for phones.
    if (window.matchMedia('(max-width: 1023px)').matches) setSheet(true)
  }
  const onMarkReviewed = async (id: string) => {
    setBusy(id)
    setErrors(({ [id]: _, ...rest }) => rest)
    try {
      const signedAt = new Date().toISOString()
      const { signature, address } = await (sign ?? walletSign)(reviewMessage(id, signedAt))
      if (admin && address.toLowerCase() !== admin.toLowerCase()) {
        throw new Error(`This wallet (${shortHex(address, 6, 4)}) is not the registry admin. Switch to ${shortHex(admin, 6, 4)} and try again.`)
      }
      const result = await (review ?? reviewReport)(id, signedAt, signature)
      setDone((d) => ({ ...d, [id]: result }))
      toast('Report marked reviewed · signed by the registry admin')
      if (!load) void q.refetch()
    } catch (e) {
      setErrors((x) => ({ ...x, [id]: errorText(e) }))
    } finally {
      setBusy(null)
    }
  }

  const detail = current ? (
    <ReportDetail
      key={current.id}
      r={current}
      admin={admin}
      busy={busy === current.id}
      error={errors[current.id]}
      now={now}
      onMarkReviewed={(id) => void onMarkReviewed(id)}
    />
  ) : null

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <PageHeader
        title="Citizen reports"
        desc="A citizen can report any access on their receipt. Saksi re-checks that receipt against the public ledger, so the verdict comes from the ledger, not from the citizen or the agency."
      />

      {q.isPending ? (
        <div className="grid gap-6 lg:grid-cols-[400px_minmax(0,1fr)]">
          <QueueSkeleton />
          <div className="hidden lg:block">
            <DetailSkeleton />
          </div>
        </div>
      ) : q.isError ? (
        <Calm
          title="Couldn’t load citizen reports"
          body={`${q.error.message} Nothing is shown, so nothing is decided.`}
          icon={<IconRefresh size={18} />}
          action={
            <Button variant="light" size="sm" icon={<IconRefresh size={15} />} onClick={onRetry}>
              Try again
            </Button>
          }
        />
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[400px_minmax(0,1fr)] xl:grid-cols-[420px_minmax(0,1fr)]">
          <section aria-labelledby="queue-h" className="flex min-w-0 flex-col gap-3 lg:sticky lg:top-6">
            <div className="flex items-center justify-between gap-3">
              <h2 id="queue-h" className="text-[15px] font-semibold text-ink">
                Queue <span className="font-normal text-ink-3">· newest first</span>
              </h2>
              <div role="group" aria-label="Show" className="inline-flex gap-1">
                {(['open', 'all'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    aria-pressed={filter === f}
                    onClick={() => setFilter(f)}
                    className={`tnum h-8 rounded-pill px-3 text-[13px] font-medium transition-colors duration-150 ${
                      filter === f ? 'bg-ink text-paper' : 'border border-line text-ink-2 hover:border-line-strong hover:text-ink'
                    }`}
                  >
                    {f === 'open' ? `Open · ${open}` : `All · ${reports.length}`}
                  </button>
                ))}
              </div>
            </div>
            {shown.length === 0 ? (
              <Calm
                icon={<IconUser size={18} />}
                title={reports.length ? 'Nothing open' : 'Nothing to review'}
                body={
                  reports.length
                    ? 'Every report has a signed review. New ones appear here the moment a citizen files one.'
                    : 'No open reports. Saksi will list them here the moment a citizen files one.'
                }
              />
            ) : (
              <ul aria-label="Citizen reports" className="flex flex-col divide-y divide-line overflow-hidden rounded-lg border border-line bg-card">
                {shown.map((r) => (
                  <QueueRow key={r.id} r={r} selected={current?.id === r.id} fresh={fresh.has(r.id)} now={now} onSelect={onSelect} />
                ))}
              </ul>
            )}
          </section>

          <div className="hidden min-w-0 lg:block">
            {detail ?? <Calm title="Pick a report" body="Its sealed record and the server’s verdict open here." />}
          </div>
        </div>
      )}

      <Sheet open={sheet && !!current} onClose={() => setSheet(false)} title="Citizen report" sub={current ? short(current.controllerName) : undefined} desktop={false}>
        {detail}
      </Sheet>
    </div>
  )
}
