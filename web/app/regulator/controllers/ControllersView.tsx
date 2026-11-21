'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useId, type ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { IconExternal, IconRefresh } from '@/components/ui/icons'
import { Skeleton } from '@/components/ui/Skeleton'
import { Quiet } from '@/components/regulator/Quiet'
import { RiseHeading } from '@/components/regulator/Rise'
import { StatRow } from '@/components/regulator/StatRow'
import { getControllerRegister, type ControllerRegisterRow, type ControllerRegisterWire } from '@/lib/data'
import { explorerAddress, explorerTx } from '@/lib/env'
import { formatWIB, shortHex } from '@/lib/format'

const POLL_MS = 15_000
const COLS = 'lg:grid-cols-[minmax(0,2.3fr)_minmax(0,1.2fr)_minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,0.8fr)_minmax(0,1.1fr)]'

const n = (v: number | null) => (v === null ? '—' : v.toLocaleString('en-US'))

function Integrity({ r }: { r: ControllerRegisterRow }) {
  if (r.altered === null || r.deleted === null) return <span className="text-ink-3">Not checked</span>
  const bad = r.altered + r.deleted
  if (!bad) return <span className="text-ok">Clean</span>
  return (
    <span className="font-medium text-bad">
      {r.altered ? `${r.altered} altered` : ''}
      {r.altered && r.deleted ? ' · ' : ''}
      {r.deleted ? `${r.deleted} deleted` : ''}
    </span>
  )
}

function Breaches({ r }: { r: ControllerRegisterRow }) {
  if (!r.breachesOnTime && !r.breachesLate) return <span className="text-ink-3">None filed</span>
  return (
    <span>
      {r.breachesOnTime ? <span className="text-ink">{r.breachesOnTime} on time</span> : null}
      {r.breachesOnTime && r.breachesLate ? <span className="text-ink-3"> · </span> : null}
      {r.breachesLate ? <span className="text-pending">{r.breachesLate} late</span> : null}
    </span>
  )
}

function StatusDot({ active }: { active: boolean }) {
  return <span aria-hidden="true" className={`block size-2 shrink-0 rounded-full ${active ? 'bg-ok' : 'bg-line-strong'}`} />
}

function Cell({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 py-2.5 text-[14px] max-lg:border-t max-lg:border-line lg:block lg:py-0 ${className}`}>
      <span className="text-[13px] text-ink-2 lg:sr-only">{label}</span>
      <span className="tnum text-right lg:text-left">{children}</span>
    </div>
  )
}

function Row({ r }: { r: ControllerRegisterRow }) {
  const active = r.status === 'active'
  return (
    <li className={`anim-rise grid gap-0 px-4 py-4 lg:items-center lg:gap-4 lg:px-5 ${COLS} ${active ? '' : 'text-ink-2'}`}>
      <div className="flex min-w-0 items-start gap-3 pb-2 lg:pb-0">
        <span className="mt-[7px] flex" title={active ? 'Active' : 'Revoked'}>
          <StatusDot active={active} />
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className={`truncate text-[15px] font-medium tracking-[-0.01em] ${active ? 'text-ink' : 'text-ink-2'}`}>{r.name}</span>
          <a
            href={explorerAddress(r.eoa)}
            target="_blank"
            rel="noreferrer"
            className="w-fit font-mono text-[12px] text-ink-3 hover:text-blue"
            aria-label={`Signing wallet ${r.eoa} on the explorer`}
          >
            {shortHex(r.eoa, 6, 4)}
          </a>
        </span>
      </div>
      <Cell label="Registered">
        <a
          href={explorerTx(r.registrationTx)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 hover:text-blue"
          aria-label={`Registration transaction ${r.registrationTx} on the explorer`}
        >
          {r.registeredAt ? formatWIB(r.registeredAt * 1000).replace(' WIB', '') : `Block ${r.registeredBlock.toLocaleString('en-US')}`}
          <IconExternal size={12} className="text-ink-3" />
        </a>
        {!active ? (
          <span className="block text-[12px] text-ink-3">
            Revoked
            {r.revocationTx ? (
              <>
                {' · '}
                <a href={explorerTx(r.revocationTx)} target="_blank" rel="noreferrer" className="hover:text-blue">
                  tx
                </a>
              </>
            ) : null}
          </span>
        ) : null}
      </Cell>
      <Cell label="Receipts sealed">{n(r.sealed)}</Cell>
      <Cell label="Watch">
        <Integrity r={r} />
      </Cell>
      <Cell label="Breach notices">
        <Breaches r={r} />
      </Cell>
      <Cell label="Open reports">
        {r.openReports ? (
          <Link href="/regulator/reports" className="font-medium text-ink underline decoration-line-strong underline-offset-4 hover:text-blue">
            {r.openReports}
          </Link>
        ) : (
          n(r.openReports)
        )}
      </Cell>
      <Cell label="Last activity">{r.lastActivity ? formatWIB(r.lastActivity).replace(' WIB', '') : <span className="text-ink-3">None yet</span>}</Cell>
    </li>
  )
}

function TableSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-card" aria-busy="true" aria-label="Loading controllers">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="flex items-center gap-6 border-b border-line p-5 last:border-b-0">
          <Skeleton className="h-5 w-1/4" />
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 flex-1" />
          <Skeleton className="h-5 w-20" />
        </div>
      ))}
    </div>
  )
}

/**
 * The on-chain register of authorised controllers: every ControllerRegistered / ControllerRevoked event since the
 * deploy block, joined with live numbers. `load` comes from the /dev gallery; the app uses GET /api/regulator/controllers.
 */
export function ControllersView({ load }: { load?: () => Promise<ControllerRegisterWire> }) {
  const instance = useId()
  const q = useQuery({
    queryKey: ['controller-register', load ? instance : 'live'],
    queryFn: load ?? getControllerRegister,
    refetchInterval: load ? false : POLL_MS,
    refetchIntervalInBackground: false,
    retry: false,
  })
  const data = q.data
  const rows = data?.controllers ?? []
  const active = rows.filter((r) => r.status === 'active').length
  const watchKnown = data?.watch != null
  const findings = rows.reduce((sum, r) => sum + (r.altered ?? 0) + (r.deleted ?? 0), 0)
  const onRetry = () => void q.refetch()

  return (
    <div className="flex flex-col gap-10 md:gap-12">
      <div className="grid gap-6 lg:grid-cols-12 lg:items-end">
        <RiseHeading
          as="h1"
          lead="Who may touch citizen data,"
          tail="and how each one behaves."
          className="text-[34px] leading-[1.04] md:text-[56px] lg:col-span-7"
        />
        <p className="max-w-[46ch] text-[16px] leading-[1.6] tracking-[0.01em] text-ink-2 md:text-[17px] lg:col-span-4 lg:col-start-9">
          Each controller below was authorised by a register call on the registry contract, and only its wallet can seal
          receipts. The numbers are live: receipts from Saksi’s store, integrity from Watch, timeliness from the breach
          contract.
        </p>
      </div>

      <StatRow
        label="Controller register"
        stats={[
          { label: 'Authorised', value: data ? active : null, hint: 'Active in the registry', tone: 'ok' },
          { label: 'Revoked', value: data ? rows.length - active : null, hint: 'Can no longer seal', tone: 'ink' },
          { label: 'Tamper findings', value: data && watchKnown ? findings : null, hint: 'Altered or deleted, from Watch', tone: 'bad', alarm: true },
        ]}
      />

      <section aria-labelledby="register-h" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id="register-h" className="text-[19px] font-medium tracking-[-0.015em] text-ink md:text-[22px]">
            Register <span className="text-ink-2">· from the chain</span>
          </h2>
          {data ? (
            <p className="text-[13px] text-ink-2">
              <a href={explorerAddress(data.registry)} target="_blank" rel="noreferrer" className="font-mono text-[12px] hover:text-blue">
                {shortHex(data.registry, 6, 4)}
              </a>{' '}
              · block <span className="tnum">{data.blockNumber.toLocaleString('en-US')}</span>
            </p>
          ) : null}
        </div>

        {data && !watchKnown ? (
          <p role="status" className="text-[14px] text-ink-2">
            Watch could not reach the chain node, so integrity is shown as not checked. This is not a sign of tampering.
          </p>
        ) : null}

        {q.isPending ? (
          <TableSkeleton />
        ) : q.isError ? (
          <Quiet
            glyph="eye"
            title="Couldn’t read the register"
            body={`${q.error.message} Nothing is shown, so nothing is decided.`}
            action={
              <Button variant="light" size="sm" icon={<IconRefresh size={15} />} onClick={onRetry}>
                Try again
              </Button>
            }
          />
        ) : rows.length === 0 ? (
          <Quiet glyph="shield" title="No controllers registered yet" body="A controller appears here as soon as the registry admin registers its wallet on chain." />
        ) : (
          <div className="overflow-hidden rounded-lg border border-line bg-card">
            <div className={`hidden border-b border-line px-5 py-3 text-[13px] text-ink-2 lg:grid lg:gap-4 ${COLS}`} aria-hidden="true">
              <span>Controller</span>
              <span>Registered</span>
              <span>Receipts sealed</span>
              <span>Watch</span>
              <span>Breach notices</span>
              <span>Open reports</span>
              <span>Last activity</span>
            </div>
            <ul aria-label="Authorised controllers" className="divide-y divide-line">
              {rows.map((r) => (
                <Row key={r.id} r={r} />
              ))}
            </ul>
          </div>
        )}
        {data ? <p className="text-[13px] text-ink-3">Times in WIB. Rows link to their registration transaction on the explorer.</p> : null}
      </section>
    </div>
  )
}
