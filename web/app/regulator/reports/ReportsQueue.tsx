'use client'

import { useQuery } from '@tanstack/react-query'
import { useId, useState } from 'react'
import type { Hex } from 'viem'
import { useAccount, useConnect, useSignMessage } from 'wagmi'
import { Badge, type StatusKind } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { IconExternal, IconRefresh, IconShield, IconWallet } from '@/components/ui/icons'
import { Skeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import { Quiet } from '@/components/regulator/Quiet'
import { RiseHeading } from '@/components/regulator/Rise'
import { StatRow } from '@/components/regulator/StatRow'
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
import { formatWIB, shortHex } from '@/lib/format'
import { EVENT_LABELS } from '@/lib/shared/types'

const POLL_MS = 5000
const VERDICT_KIND: Record<ReportVerdict, StatusKind> = { MATCH: 'MATCH', ALTERED: 'ALTERED', DELETED: 'DELETED', NOT_FOUND: 'NOT_FOUND' }
const VERDICT_NOTE: Record<ReportVerdict, string> = {
  MATCH: 'Store matches the chain',
  ALTERED: 'Store differs from the chain',
  DELETED: 'Missing from the store, still on chain',
  NOT_FOUND: 'Not on chain yet, or the node did not answer',
}

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

function ListSkeleton() {
  return (
    <ul className="flex flex-col border-t border-line" aria-busy="true" aria-label="Loading reports">
      {Array.from({ length: 4 }, (_, i) => (
        <li key={i} className="grid gap-3 border-b border-line py-5 md:grid-cols-[1fr_auto] md:items-center">
          <span className="flex flex-col gap-2">
            <Skeleton className="h-5 w-2/5" />
            <Skeleton className="h-3.5 w-3/5" />
          </span>
          <Skeleton className="h-8 w-48" />
        </li>
      ))}
    </ul>
  )
}

function ReportRow({
  r,
  busy,
  error,
  onMarkReviewed,
}: {
  r: RegulatorReportWire
  busy: boolean
  error?: string
  onMarkReviewed: (id: string) => void
}) {
  const open = r.status === 'open'
  return (
    <li className="anim-rise border-b border-line py-5">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-start md:gap-8">
        <div className="flex min-w-0 flex-col gap-1.5">
          <p className="flex items-center gap-2.5 text-[16px] font-medium leading-snug tracking-[-0.01em] text-ink">
            <span aria-hidden="true" className={`size-[7px] shrink-0 rounded-full ${open ? 'bg-blue' : 'bg-line-strong'}`} />
            {REPORT_REASON_LABEL[r.reason]}
          </p>
          <p className="pl-[17px] text-[14px] leading-relaxed text-ink-2">
            <span className="text-ink">{r.controllerName}</span> · {EVENT_LABELS[r.eventType]} · citizen{' '}
            <span className="font-mono text-[13px] text-ink">{r.citizenMasked}</span> · reported {formatWIB(r.createdAt)}
          </p>
          {r.note ? (
            <p className="ml-[17px] mt-1 max-w-[62ch] border-l-2 border-line pl-3 text-[14px] leading-relaxed text-ink-2">“{r.note}”</p>
          ) : null}
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 pl-[17px] text-[13px] text-ink-3">
            {r.sealedAt ? <span>Sealed {formatWIB(r.sealedAt * 1000)}</span> : <span>Not sealed on chain</span>}
            {r.txHash ? (
              <a
                href={explorerTx(r.txHash)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-8 items-center gap-1 font-mono text-[12px] text-ink-2 hover:text-blue"
              >
                {shortHex(r.txHash, 8, 6)}
                {r.logIndex !== null ? ` · log ${r.logIndex}` : ''}
                <IconExternal size={12} />
              </a>
            ) : null}
            {!open && r.reviewedAt ? (
              <span>
                Reviewed {formatWIB(r.reviewedAt)}
                {r.reviewedBy ? <> by <span className="font-mono text-[12px]">{shortHex(r.reviewedBy, 6, 4)}</span></> : null}
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 pl-[17px] md:flex-col md:items-end md:pl-0">
          <span className="flex flex-col items-start gap-1 md:items-end">
            <Badge kind={VERDICT_KIND[r.serverVerdict]} size="sm" />
            <span className="text-[12px] text-ink-3">{VERDICT_NOTE[r.serverVerdict]}</span>
          </span>
          {open ? (
            <Button variant="light" size="sm" loading={busy} disabled={busy} icon={<IconWallet size={15} />} onClick={() => onMarkReviewed(r.id)}>
              {busy ? 'Waiting for signature' : 'Mark reviewed'}
            </Button>
          ) : (
            <span className="inline-flex h-7 items-center rounded-pill border border-line px-2.5 text-[12px] font-medium text-ink-2">Reviewed</span>
          )}
        </div>
      </div>
      {error ? (
        <p role="alert" className="mt-3 pl-[17px] text-[14px] text-ink">
          {error}
        </p>
      ) : null}
    </li>
  )
}

/**
 * Citizen reports queue. Each verdict was computed by the server against the chain when the report arrived.
 * Marking a report reviewed asks the ControllerRegistry admin wallet for a message signature.
 * `load` / `sign` / `review` come from the /dev gallery; the app uses the real API and the injected wallet.
 */
export function ReportsQueue({ load, sign, review }: { load?: () => Promise<RegulatorReportsWire>; sign?: Sign; review?: Review }) {
  const instance = useId()
  const walletSign = useWalletSigner()
  const { toast } = useToast()
  const q = useQuery({
    queryKey: ['regulator-reports', load ? instance : 'live'],
    queryFn: load ?? getRegulatorReports,
    refetchInterval: load ? false : POLL_MS,
    refetchIntervalInBackground: false,
    retry: false,
  })
  const [filter, setFilter] = useState<'open' | 'all'>('open')
  const [busy, setBusy] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [done, setDone] = useState<Record<string, ReviewResult>>({})

  const data = q.data
  const reports = (data?.reports ?? []).map((r) => {
    const d = done[r.id]
    return d ? { ...r, status: d.status, reviewedAt: d.reviewedAt, reviewedBy: d.reviewedBy } : r
  })
  const shown = filter === 'open' ? reports.filter((r) => r.status === 'open') : reports
  const open = reports.filter((r) => r.status === 'open').length
  const disagree = reports.filter((r) => r.serverVerdict === 'ALTERED' || r.serverVerdict === 'DELETED').length
  const admin = data?.admin ?? null

  const onRetry = () => void q.refetch()
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

  return (
    <div className="flex flex-col gap-10 md:gap-12">
      <div className="grid gap-6 lg:grid-cols-12 lg:items-end">
        <RiseHeading
          as="h1"
          lead="Citizens flag it."
          tail="The chain checks it."
          className="text-[34px] leading-[1.04] md:text-[56px] lg:col-span-7"
        />
        <p className="max-w-[46ch] text-[16px] leading-[1.6] tracking-[0.01em] text-ink-2 md:text-[17px] lg:col-span-4 lg:col-start-9">
          A citizen can report any access on their receipt. When a report arrives, Saksi checks that receipt against the
          chain itself, so the verdict here comes from the chain, not from the citizen or the company.
        </p>
      </div>

      <StatRow
        label="Citizen reports"
        stats={[
          { label: 'Open', value: data ? open : null, hint: 'Waiting for review', tone: 'ink' },
          { label: 'Reviewed', value: data ? reports.length - open : null, hint: 'Signed off by the admin wallet', tone: 'ok' },
          { label: 'Chain disagrees', value: data ? disagree : null, hint: 'Altered or deleted in the store', tone: 'bad', alarm: true },
        ]}
      />

      <section aria-labelledby="queue-h" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 id="queue-h" className="text-[19px] font-medium tracking-[-0.015em] text-ink md:text-[22px]">
            Queue <span className="text-ink-2">· newest first</span>
          </h2>
          <div role="group" aria-label="Show" className="inline-flex rounded-md border border-line bg-card p-1">
            {(['open', 'all'] as const).map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
                className={`min-h-9 rounded-sm px-3.5 text-[14px] font-medium transition-colors duration-150 ${
                  filter === f ? 'bg-ink text-paper' : 'text-ink-2 hover:text-ink'
                }`}
              >
                {f === 'open' ? `Open${data ? ` · ${open}` : ''}` : `All${data ? ` · ${reports.length}` : ''}`}
              </button>
            ))}
          </div>
        </div>

        <p className="flex items-start gap-2.5 text-[14px] leading-relaxed text-ink-2">
          <IconShield size={16} className="mt-0.5 shrink-0 text-ink" />
          <span>
            Only the registry admin wallet
            {admin ? (
              <>
                {' '}
                <span className="font-mono text-[13px] text-ink">{shortHex(admin, 6, 4)}</span>
              </>
            ) : null}{' '}
            can mark a report reviewed. It signs a message, so there is no transaction and no gas.
          </span>
        </p>

        {q.isPending ? (
          <ListSkeleton />
        ) : q.isError ? (
          <Quiet
            glyph="eye"
            title="Couldn’t load citizen reports"
            body={`${q.error.message} The counts above stay empty until the list loads.`}
            action={
              <Button variant="light" size="sm" icon={<IconRefresh size={15} />} onClick={onRetry}>
                Try again
              </Button>
            }
          />
        ) : shown.length === 0 ? (
          <Quiet
            glyph="check"
            title={reports.length ? 'Nothing open' : 'No citizen reports yet'}
            body={
              reports.length
                ? 'Every report has been reviewed. New ones appear here within a few seconds.'
                : 'When a citizen reports an access from their receipt, it appears here with the chain’s verdict.'
            }
          />
        ) : (
          <ul className="flex flex-col border-t border-line" aria-label="Citizen reports">
            {shown.map((r) => (
              <ReportRow key={r.id} r={r} busy={busy === r.id} error={errors[r.id]} onMarkReviewed={(id) => void onMarkReviewed(id)} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
