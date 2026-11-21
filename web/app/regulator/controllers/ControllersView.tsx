'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useId, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { IconArrow, IconArrowUpRight, IconRefresh, IconShield } from '@/components/ui/icons'
import { Skeleton } from '@/components/ui/Skeleton'
import { Sheet } from '@/components/regulator/Sheet'
import { standingOf, tampered } from '@/components/regulator/standing'
import { Calm, Fact, PageHeader, plainDate, plainTime, ProofRow, StandingChip, TechnicalProof } from '@/components/regulator/Workspace'
import {
  getBreachList,
  getControllerRegister,
  getRegulatorReports,
  REPORT_REASON_LABEL,
  type BreachListWire,
  type ControllerRegisterRow,
  type ControllerRegisterWire,
  type RegulatorReportsWire,
} from '@/lib/data'
import { explorerAddress, explorerTx } from '@/lib/env'
import { shortHex } from '@/lib/format'
import '../regulator.css'

const POLL_MS = 15_000
const COLS = 'grid-cols-[44px_minmax(0,2.2fr)_minmax(0,0.8fr)_minmax(0,1.1fr)_minmax(0,1.1fr)_minmax(0,0.8fr)_minmax(0,1.3fr)]'
const short = (name: string) => name.replace(' (fictional)', '').replace(' (fiktif)', '')
const registered = (r: ControllerRegisterRow) => (r.registeredAt ? plainDate(r.registeredAt * 1000) : 'Date not read')

function Integrity({ r }: { r: ControllerRegisterRow }) {
  if (r.altered === null || r.deleted === null) return <span className="text-ink-3">Not checked</span>
  if (!tampered(r)) return <span className="text-ink-3">None</span>
  return (
    <span className="font-medium text-bad">
      {[r.altered ? `${r.altered} changed` : '', r.deleted ? `${r.deleted} deleted` : ''].filter(Boolean).join(' · ')}
    </span>
  )
}

function Breaches({ r }: { r: ControllerRegisterRow }) {
  if (!r.breachesOnTime && !r.breachesLate) return <span className="text-ink-3">None filed</span>
  return (
    <span>
      {r.breachesOnTime ? <span className="text-ink">{r.breachesOnTime} on time</span> : null}
      {r.breachesOnTime && r.breachesLate ? <span className="text-ink-3"> · </span> : null}
      {r.breachesLate ? <span className="font-medium text-pending">{r.breachesLate} late</span> : null}
    </span>
  )
}

function TableSkeleton() {
  return (
    <div className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-card" aria-busy="true" aria-label="Loading agencies">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="flex items-center gap-6 px-5 py-4">
          <Skeleton className="h-4 w-8" />
          <span className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3 w-1/4" />
          </span>
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-7 w-28 rounded-pill" />
        </div>
      ))}
    </div>
  )
}

/** One agency's history, for the side sheet: standing, numbers, its notices and reports, then the technical proof. */
function AgencyHistory({
  r,
  watchKnown,
  reports,
  breaches,
}: {
  r: ControllerRegisterRow
  watchKnown: boolean
  reports?: RegulatorReportsWire
  breaches?: BreachListWire
}) {
  const s = standingOf(r, watchKnown)
  const theirReports = (reports?.reports ?? []).filter((x) => x.controllerId.toLowerCase() === r.id.toLowerCase())
  const theirNotices = (breaches?.rows ?? []).filter((b) => short(b.controllerName) === short(r.name))
  type Ev = { at: number; text: string; tone?: 'bad' | 'pending'; href?: string }
  const events: Ev[] = [
    ...(r.registeredAt ? [{ at: r.registeredAt * 1000, text: 'Registered on the public ledger by the registry admin' }] : []),
    ...theirNotices.map((b) => ({
      at: b.detectedAt * 1000,
      text: `Breach notice “${b.title}” · ${b.mode === 'late' ? `${Math.round(b.lateBySec / 3600)} h late` : `on time, ${Math.round(b.hoursUsed)} h of 72`}`,
      tone: b.mode === 'late' ? ('pending' as const) : undefined,
      href: `/regulator/breach/${b.id}`,
    })),
    ...theirReports.map((x) => ({
      at: new Date(x.createdAt).getTime(),
      text: `Citizen ${x.citizenMasked}: ${REPORT_REASON_LABEL[x.reason]}${x.status === 'reviewed' ? ' · reviewed' : ''}`,
      tone: x.serverVerdict === 'ALTERED' || x.serverVerdict === 'DELETED' ? ('bad' as const) : undefined,
      href: '/regulator/reports',
    })),
  ].sort((a, b) => b.at - a.at)

  return (
    <div className="rg2-swap flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <StandingChip s={s} className="w-fit" />
        <p className="text-[14px] leading-relaxed text-ink-2">{s.note}</p>
      </div>
      <dl className="rounded-lg border border-line bg-card px-4">
        <Fact k="Registered">{registered(r)}</Fact>
        <Fact k="Receipts sealed">{r.sealed.toLocaleString('en-US')}</Fact>
        <Fact k="Changed or deleted" tone={tampered(r) ? 'bad' : undefined}>
          <Integrity r={r} />
        </Fact>
        <Fact k="Breach notices">
          <Breaches r={r} />
        </Fact>
        <Fact k="Open reports">{r.openReports ?? 'Not available'}</Fact>
        <Fact k="Last activity">{r.lastActivity ? plainTime(r.lastActivity) : 'None yet'}</Fact>
      </dl>

      <section aria-labelledby="hist-h">
        <h3 id="hist-h" className="text-[15px] font-semibold text-ink">
          History
        </h3>
        {events.length === 0 ? (
          <p className="mt-2 text-[14px] text-ink-2">Nothing recorded yet.</p>
        ) : (
          <ol className="mt-3 flex flex-col">
            {events.map((e, i) => (
              <li key={i} className="relative flex gap-3 pb-4 last:pb-0">
                <span className="flex flex-col items-center">
                  <span
                    aria-hidden="true"
                    className={`mt-1.5 size-2 shrink-0 rounded-full ${e.tone === 'bad' ? 'bg-bad' : e.tone === 'pending' ? 'bg-pending' : 'bg-ink-3'}`}
                  />
                  {i < events.length - 1 ? <span aria-hidden="true" className="mt-1 w-px flex-1 bg-line" /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[12px] text-ink-3">{plainTime(e.at)}</span>
                  {e.href ? (
                    <Link href={e.href} className="text-[14px] leading-snug text-ink hover:text-blue">
                      {e.text}
                    </Link>
                  ) : (
                    <span className="text-[14px] leading-snug text-ink">{e.text}</span>
                  )}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {r.status === 'revoked' ? (
        <p className="rounded-lg bg-paper-2 px-4 py-3 text-[14px] text-ink-2">Revoked by the registry admin. Its wallet can no longer seal receipts; what it sealed stays on the public ledger.</p>
      ) : null}

      <TechnicalProof>
        <ProofRow k="Signing wallet">
          <a href={explorerAddress(r.eoa)} target="_blank" rel="noreferrer" className="inline-flex min-h-8 items-center gap-1 hover:text-blue">
            {shortHex(r.eoa, 6, 4)} <IconArrowUpRight size={12} />
          </a>
        </ProofRow>
        <ProofRow k="Registration">
          <a href={explorerTx(r.registrationTx)} target="_blank" rel="noreferrer" className="inline-flex min-h-8 items-center gap-1 hover:text-blue">
            {shortHex(r.registrationTx, 6, 4)} <IconArrowUpRight size={12} />
          </a>
        </ProofRow>
        <ProofRow k="Block">{r.registeredBlock.toLocaleString('en-US')}</ProofRow>
        {r.revocationTx ? (
          <ProofRow k="Revocation">
            <a href={explorerTx(r.revocationTx)} target="_blank" rel="noreferrer" className="inline-flex min-h-8 items-center gap-1 hover:text-blue">
              {shortHex(r.revocationTx, 6, 4)} <IconArrowUpRight size={12} />
            </a>
          </ProofRow>
        ) : null}
      </TechnicalProof>
    </div>
  )
}

/**
 * The register of agencies (controllers) authorised on the public ledger, each as a register entry with
 * its compliance standing. A row opens a sheet with that agency's history (side sheet from 1024, bottom
 * sheet on phones). `load` / `loadReports` / `loadBreaches` come from the /dev gallery.
 */
export function ControllersView({
  load,
  loadReports,
  loadBreaches,
}: {
  load?: () => Promise<ControllerRegisterWire>
  loadReports?: () => Promise<RegulatorReportsWire>
  loadBreaches?: () => Promise<BreachListWire>
}) {
  const instance = useId()
  const q = useQuery({
    queryKey: ['controller-register', load ? instance : 'live'],
    queryFn: load ?? getControllerRegister,
    refetchInterval: load ? false : POLL_MS,
    refetchIntervalInBackground: false,
    retry: false,
  })
  const rq = useQuery({ queryKey: ['regulator-reports', loadReports ? instance : 'live'], queryFn: loadReports ?? getRegulatorReports, retry: false })
  const bq = useQuery({ queryKey: ['breach-list', loadBreaches ? instance : 'live'], queryFn: loadBreaches ?? getBreachList, retry: false })
  const [sel, setSel] = useState<string | null>(null)

  const data = q.data
  const rows = data?.controllers ?? []
  const watchKnown = data?.watch != null
  const active = rows.filter((r) => r.status === 'active').length
  const current = rows.find((r) => r.id === sel)
  // Keeps the last agency on screen while the sheet slides out.
  const last = useRef<ControllerRegisterRow | undefined>(undefined)
  if (current) last.current = current
  const shown = current ?? last.current
  const onRetry = () => void q.refetch()
  const onOpen = (id: string) => setSel(id)
  const onClose = () => setSel(null)

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <PageHeader
        title="Agencies"
        desc="The register of agencies allowed to touch citizen data. Each was authorised on the public ledger, and only its wallet can seal receipts."
      />

      {data ? (
        <p className="-mt-2 text-[13px] text-ink-3">
          {active} active · {rows.length - active} revoked · Checked just now
          {!watchKnown ? ' · Watch could not reach the public ledger, so integrity shows as not checked. This is not a sign of tampering.' : ''}
        </p>
      ) : null}

      {q.isPending ? (
        <TableSkeleton />
      ) : q.isError ? (
        <Calm
          title="Couldn’t read the register"
          body={`${q.error.message} Nothing is shown, so nothing is decided.`}
          icon={<IconRefresh size={18} />}
          action={
            <Button variant="light" size="sm" icon={<IconRefresh size={15} />} onClick={onRetry}>
              Try again
            </Button>
          }
        />
      ) : rows.length === 0 ? (
        <Calm icon={<IconShield size={18} />} title="No agencies registered yet" body="An agency appears here as soon as the registry admin registers its wallet on the public ledger." />
      ) : (
        <div className="overflow-hidden rounded-lg border border-line bg-card">
          <div className={`hidden gap-4 border-b border-line px-5 py-3 text-[13px] text-ink-3 lg:grid ${COLS}`} aria-hidden="true">
            <span>No.</span>
            <span>Agency</span>
            <span className="text-right">Sealed</span>
            <span>Changed / deleted</span>
            <span>Breach notices</span>
            <span className="text-right">Open reports</span>
            <span>Standing</span>
          </div>
          <ul aria-label="Registered agencies" className="divide-y divide-line">
            {rows.map((r, i) => {
              const s = standingOf(r, watchKnown)
              const off = r.status !== 'active'
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => onOpen(r.id)}
                    aria-haspopup="dialog"
                    aria-current={sel === r.id ? 'true' : undefined}
                    className={`rg2-entry relative w-full px-4 py-3.5 text-left lg:grid lg:items-center lg:gap-4 lg:px-5 lg:py-4 ${COLS} ${tampered(r) ? 'rg2-entry-bad' : ''}`}
                  >
                    <span className="rg2-serial hidden font-mono text-[12px] text-ink-3 lg:block">{String(i + 1).padStart(3, '0')}</span>
                    {/* phones: two lines + chip */}
                    <span className="flex items-start justify-between gap-3 lg:hidden">
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className={`text-[15px] font-medium leading-snug ${off ? 'text-ink-2' : 'text-ink'}`}>{short(r.name)}</span>
                        <span className="tnum text-[13px] text-ink-3">
                          {r.sealed} sealed
                          {tampered(r) ? <span className="text-bad"> · {tampered(r)} tampered</span> : null}
                          {r.breachesLate ? <span className="text-pending"> · {r.breachesLate} late</span> : null}
                          {r.openReports ? ` · ${r.openReports} open` : ''}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <StandingChip s={s} />
                        <IconArrow size={13} className="text-ink-3" />
                      </span>
                    </span>
                    {/* desktop: register columns */}
                    <span className="hidden min-w-0 flex-col gap-0.5 lg:flex">
                      <span className={`truncate text-[15px] font-medium ${off ? 'text-ink-2' : 'text-ink'}`}>{short(r.name)}</span>
                      <span className="text-[13px] text-ink-3">Registered {registered(r)}</span>
                    </span>
                    <span className="tnum hidden text-right text-[14px] text-ink lg:block">{r.sealed.toLocaleString('en-US')}</span>
                    <span className="hidden text-[14px] lg:block">
                      <Integrity r={r} />
                    </span>
                    <span className="hidden text-[14px] lg:block">
                      <Breaches r={r} />
                    </span>
                    <span className="tnum hidden text-right text-[14px] lg:block">
                      {r.openReports ? <span className="font-medium text-ink">{r.openReports}</span> : <span className="text-ink-3">{r.openReports === null ? '—' : 0}</span>}
                    </span>
                    <span className="hidden items-center justify-between gap-2 lg:flex">
                      <StandingChip s={s} />
                      <IconArrow size={13} className="text-ink-3" />
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
      {data ? <p className="text-[13px] text-ink-3">Times in WIB. Open an agency for its history and the technical proof of its registration.</p> : null}

      <Sheet open={!!current} onClose={onClose} title={shown ? short(shown.name) : 'Agency'} sub={shown ? `Register entry · ${shown.status === 'active' ? 'active' : 'revoked'}` : undefined}>
        {shown ? <AgencyHistory r={shown} watchKnown={watchKnown} reports={rq.data} breaches={bq.data} /> : null}
      </Sheet>
    </div>
  )
}
