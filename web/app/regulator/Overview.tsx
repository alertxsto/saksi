'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useId } from 'react'
import { Button } from '@/components/ui/Button'
import { IconArrow, IconRefresh } from '@/components/ui/icons'
import { Skeleton } from '@/components/ui/Skeleton'
import { ago, Calm, Kpi, PageHeader, StandingChip } from '@/components/regulator/Workspace'
import { standingOf, tampered } from '@/components/regulator/standing'
import {
  getBreachList,
  getControllerRegister,
  getRegulatorReports,
  REPORT_REASON_LABEL,
  type BreachListWire,
  type ControllerRegisterWire,
  type RegulatorReportsWire,
} from '@/lib/data'
import { useNow } from '@/lib/hooks'
import './regulator.css'

type Tone = 'bad' | 'pending' | 'neutral'
type Entry = { key: string; tone: Tone; title: string; meta: string; chip: string; href: string; at: number }

const TONE_ORDER: Record<Tone, number> = { bad: 0, pending: 1, neutral: 2 }
const DOT: Record<Tone, string> = { bad: 'bg-bad', pending: 'bg-pending', neutral: 'bg-blue' }
const CHIP: Record<Tone, string> = {
  bad: 'bg-bad-bg text-bad border-bad/25',
  pending: 'bg-pending-bg text-pending border-pending/25',
  neutral: 'bg-card text-ink border-line-strong',
}
const short = (name: string) => name.replace(' (fictional)', '').replace(' (fiktif)', '')

/** Register entries that need the regulator, red (tamper) first, then amber (late), then open reports. */
function attention(
  reports: RegulatorReportsWire | undefined,
  register: ControllerRegisterWire | undefined,
  breaches: BreachListWire | undefined,
  now: number,
): Entry[] {
  const out: Entry[] = []
  for (const c of register?.controllers ?? []) {
    const n = tampered(c)
    if (!n) continue
    const parts = [c.altered ? `${c.altered} changed after sealing` : '', c.deleted ? `${c.deleted} deleted by the agency` : ''].filter(Boolean)
    out.push({
      key: `c-${c.id}`,
      tone: 'bad',
      title: `${short(c.name)} no longer matches its sealed record`,
      meta: `${parts.join(' · ')} · found by Watch · UU PDP Pasal 32`,
      chip: 'Record tampered',
      href: '/regulator/watch',
      at: c.lastActivity ? new Date(c.lastActivity).getTime() : 0,
    })
  }
  for (const b of breaches?.rows ?? []) {
    if (b.mode !== 'late') continue
    out.push({
      key: `b-${b.id}`,
      tone: 'pending',
      title: `${short(b.controllerName)} filed a breach notice late`,
      meta: `${Math.round(b.lateBySec / 3600)} h past the 3×24 h limit · UU PDP Pasal 46`,
      chip: 'Late notice',
      href: `/regulator/breach/${b.id}`,
      at: b.detectedAt * 1000,
    })
  }
  for (const r of reports?.reports ?? []) {
    if (r.status !== 'open') continue
    const bad = r.serverVerdict === 'ALTERED' || r.serverVerdict === 'DELETED'
    out.push({
      key: `r-${r.id}`,
      tone: bad ? 'bad' : 'neutral',
      title: `Citizen ${r.citizenMasked} reported ${short(r.controllerName)}`,
      meta: `${REPORT_REASON_LABEL[r.reason]} · ${ago(r.createdAt, now)}`,
      chip: r.serverVerdict === 'ALTERED' ? 'Changed after sealing' : r.serverVerdict === 'DELETED' ? 'Deleted by the agency' : 'Open report',
      href: '/regulator/reports',
      at: new Date(r.createdAt).getTime(),
    })
  }
  return out.sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone] || b.at - a.at)
}

function EntrySkeleton() {
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-card" aria-busy="true" aria-label="Loading">
      {Array.from({ length: 4 }, (_, i) => (
        <li key={i} className="flex items-center gap-4 px-5 py-4">
          <Skeleton className="h-4 w-8" />
          <span className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-3/5" />
            <Skeleton className="h-3 w-2/5" />
          </span>
          <Skeleton className="h-7 w-28 rounded-pill" />
        </li>
      ))}
    </ul>
  )
}

/**
 * Regulator overview: four calm tiles (open reports, agencies with a tampered record, breach notices late vs
 * on time, receipts witnessed) and the register entries that need attention. Loaders come from the /dev
 * gallery; the app reads the same three live endpoints the other pages use (shared query cache).
 */
export function Overview({
  loadReports,
  loadRegister,
  loadBreaches,
}: {
  loadReports?: () => Promise<RegulatorReportsWire>
  loadRegister?: () => Promise<ControllerRegisterWire>
  loadBreaches?: () => Promise<BreachListWire>
}) {
  const g = useId()
  const now = useNow() ?? 0
  const rq = useQuery({ queryKey: ['regulator-reports', loadReports ? g : 'live'], queryFn: loadReports ?? getRegulatorReports, retry: false, refetchInterval: loadReports ? false : 5000, refetchIntervalInBackground: false })
  const cq = useQuery({ queryKey: ['controller-register', loadRegister ? g : 'live'], queryFn: loadRegister ?? getControllerRegister, retry: false })
  const bq = useQuery({ queryKey: ['breach-list', loadBreaches ? g : 'live'], queryFn: loadBreaches ?? getBreachList, retry: false })

  const reports = rq.data
  const register = cq.data
  const breaches = bq.data
  const open = reports ? reports.reports.filter((r) => r.status === 'open').length : null
  const watchKnown = register ? register.watch !== null : false
  const tamperedAgencies = register && watchKnown ? register.controllers.filter((c) => tampered(c) > 0).length : null
  const witnessed = register ? register.controllers.reduce((s, c) => s + c.sealed, 0) : null
  const pending = rq.isPending || cq.isPending || bq.isPending
  const allFailed = rq.isError && cq.isError && bq.isError
  const entries = attention(reports, register, breaches, now)
  const agencies = register?.controllers ?? []

  const onRetry = () => {
    void rq.refetch()
    void cq.refetch()
    void bq.refetch()
  }

  return (
    <div className="flex flex-col gap-8 lg:gap-10">
      <PageHeader
        title="Overview"
        desc={
          <>
            What Saksi witnessed across every registered agency. Read-only: you can sign a review, never change a record.{' '}
            {!pending && !allFailed ? <span className="text-ink-3">Checked just now.</span> : null}
          </>
        }
      />

      {allFailed ? (
        <Calm
          title="Couldn’t reach the Saksi server"
          body={`${rq.error?.message ?? ''} Nothing is shown, so nothing is decided. This is not a sign of tampering.`}
          icon={<IconRefresh size={18} />}
          action={
            <Button variant="light" size="sm" icon={<IconRefresh size={15} />} onClick={onRetry}>
              Try again
            </Button>
          }
        />
      ) : (
        <>
          <section aria-label="At a glance" className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            <Kpi label="Open citizen reports" value={open} hint="Waiting for your signed review" unknown={rq.isError} />
            <Kpi
              label="Agencies with a tampered record"
              value={tamperedAgencies}
              tone={tamperedAgencies ? 'bad' : 'ink'}
              hint={register && !watchKnown ? 'Watch could not reach the ledger' : 'Changed or deleted after sealing'}
              unknown={cq.isError || (!!register && !watchKnown)}
            />
            <Kpi
              label="Breach notices late"
              value={breaches ? breaches.stats.late : null}
              unit={breaches ? `of ${breaches.stats.total}` : undefined}
              tone={breaches?.stats.late ? 'pending' : 'ink'}
              hint={breaches ? `${breaches.stats.onTime} on time within 3×24 h · Pasal 46` : 'Within 3×24 h · Pasal 46'}
              unknown={bq.isError}
            />
            <Kpi label="Receipts witnessed" value={witnessed} hint="Sealed on the public ledger" unknown={cq.isError} />
          </section>

          <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_340px] xl:gap-10">
            <section aria-labelledby="attn-h" className="flex min-w-0 flex-col gap-3">
              <div className="flex min-h-8 items-center justify-between gap-3">
                <h2 id="attn-h" className="text-[15px] font-semibold text-ink">
                  Needs attention
                </h2>
                {entries.length ? <span className="tnum text-[13px] text-ink-3">{entries.length} entries</span> : null}
              </div>
              {pending && !entries.length ? (
                <EntrySkeleton />
              ) : entries.length === 0 ? (
                <Calm
                  title="Nothing needs attention"
                  body="Every sealed record matches, every breach notice came in on time and no citizen report is open."
                />
              ) : (
                <ol className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-card">
                  {entries.map((e, i) => (
                    <li key={e.key} className="relative">
                      <Link href={e.href} className={`rg2-entry relative flex items-center gap-3 px-4 py-3.5 lg:gap-4 lg:px-5 ${e.tone === 'bad' ? 'rg2-entry-bad' : ''}`}>
                        <span className="rg2-serial hidden w-8 shrink-0 font-mono text-[12px] text-ink-3 sm:block">{String(i + 1).padStart(2, '0')}</span>
                        <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${DOT[e.tone]}`} />
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="text-[15px] font-medium leading-snug text-ink">{e.title}</span>
                          <span className="text-[13px] leading-snug text-ink-3">{e.meta}</span>
                        </span>
                        <span className={`hidden h-7 shrink-0 items-center whitespace-nowrap rounded-pill border px-2.5 text-[13px] font-medium md:inline-flex ${CHIP[e.tone]}`}>
                          {e.chip}
                        </span>
                        <IconArrow size={14} className="shrink-0 text-ink-3" />
                      </Link>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <section aria-labelledby="ag-h" className="flex min-w-0 flex-col gap-3">
              <div className="flex min-h-8 items-center justify-between gap-3">
                <h2 id="ag-h" className="text-[15px] font-semibold text-ink">
                  Agencies
                </h2>
                <Link href="/regulator/controllers" className="flex min-h-8 items-center gap-1 text-[13px] text-ink-2 hover:text-blue">
                  Open the register <IconArrow size={12} />
                </Link>
              </div>
              {cq.isPending ? (
                <Skeleton className="h-56 w-full rounded-lg" />
              ) : cq.isError ? (
                <p className="rounded-lg border border-dashed border-line-strong px-4 py-5 text-[14px] text-ink-2">The register did not load. Nothing is decided.</p>
              ) : agencies.length === 0 ? (
                <p className="rounded-lg border border-dashed border-line-strong px-4 py-5 text-[14px] text-ink-2">No agency is registered yet.</p>
              ) : (
                <ul className="divide-y divide-line rounded-lg border border-line bg-card">
                  {agencies.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
                      <span className="flex min-w-0 flex-col">
                        <span className={`truncate text-[14px] font-medium ${c.status === 'active' ? 'text-ink' : 'text-ink-2'}`}>{short(c.name)}</span>
                        <span className="tnum text-[12px] text-ink-3">{c.sealed.toLocaleString('en-US')} receipts sealed</span>
                      </span>
                      <StandingChip s={standingOf(c, register?.watch !== null)} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  )
}
