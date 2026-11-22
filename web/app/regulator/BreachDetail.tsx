'use client'

import { useQuery } from '@tanstack/react-query'
import { useId, type ReactNode } from 'react'
import { Button, ButtonLink } from '@/components/ui/Button'
import { IconArrowUpRight, IconDownload, IconExternal, IconQuestion, IconRefresh } from '@/components/ui/icons'
import { Skeleton } from '@/components/ui/Skeleton'
import { Timeline72 } from '@/components/ui/Timeline72'
import { EXPLORER_CAPTION, EXPLORER_HOST } from '@/components/regulator/explorer'
import { Quiet } from '@/components/regulator/Quiet'
import { Fact, plainTime, ProofRow, sealedPhrase, StandingChip, TechnicalProof } from '@/components/regulator/Workspace'
import { explorerLink, getBreach, type BreachDetailView } from '@/lib/data'
import { CHAIN_NAME } from '@/lib/env'
import { shortHex } from '@/lib/format'
import type { BreachRow } from '@/lib/shared/types'


/** Same chip grammar as agency standing: amber pill for late, green check + text for on time. */
export function breachBadge(b: BreachRow) {
  return b.mode === 'late' ? (
    <StandingChip s={{ label: `Late · ${Math.round(b.lateBySec / 3600)} h`, tone: 'pending', note: '' }} />
  ) : (
    <StandingChip s={{ label: `On time · ${Math.round(b.hoursUsed)} h`, tone: 'ok', note: '' }} className="h-7" />
  )
}

const PASAL46: { key: keyof BreachDetailView['pasal46']; label: string }[] = [
  { key: 'dataAffected', label: '(a) Data affected' },
  { key: 'whenAndHow', label: '(b) When and how' },
  { key: 'actionsTaken', label: '(c) Actions taken' },
  { key: 'contact', label: '(d) Contact for citizens' },
]

/** One line of the technical proof: value + copy, and an explorer link when there is one. */
function ProofLine({ k, children, href, hrefLabel }: { k: string; children: ReactNode; href?: string; hrefLabel?: string }) {
  return (
    <ProofRow k={k}>
      {children}
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          aria-label={hrefLabel}
          className="-my-2 flex h-9 w-9 items-center justify-center rounded-sm text-ink-3 transition-colors hover:bg-ink/[.05] hover:text-blue"
        >
          <IconArrowUpRight size={14} />
        </a>
      ) : null}
    </ProofRow>
  )
}

export function BreachDetail({ b }: { b: BreachDetailView }) {
  const late = b.mode === 'late'
  const lateH = Math.round(b.lateBySec / 3600)
  const spare = Math.max(0, 72 - b.hoursUsed)

  const onExport = () => window.print()

  return (
    <article className="flex flex-col gap-10" aria-labelledby={`b-${b.id}`}>
      <div>
        <h2 id={`b-${b.id}`} className="text-balance text-[24px] font-semibold leading-[1.15] tracking-[-0.02em] text-ink md:text-[28px]">
          {b.title}
        </h2>
        <p className="mt-3 text-[16px] leading-[1.6] tracking-[0.01em] text-ink-2">
          {b.controllerName}
        </p>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6 border-t border-line pt-6">
        <div className="min-w-0">
          <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-ink">
            <span className={`tnum text-[44px] font-semibold leading-none tracking-[-0.03em] md:text-[56px] ${late ? 'text-pending' : 'text-ink'}`}>
              {b.hoursUsed.toFixed(1)}
              <span className="ml-1 text-[20px] font-medium tracking-normal text-ink-2">h</span>
            </span>
            <span className="text-[14px] text-ink-2">used of 3×24 h</span>
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
            {late ? (
              <StandingChip s={{ label: `Late by ${lateH} h`, tone: 'pending', note: '' }} />
            ) : (
              <StandingChip s={{ label: `On time · ${spare.toFixed(1)} h to spare`, tone: 'ok', note: '' }} className="h-7" />
            )}
            <span className="text-[13px] text-ink-3">Decided by the contract, not by Saksi</span>
          </div>
        </div>
      </div>

      <section aria-label="72-hour window">
        <Timeline72 detectedAt={b.detectedAt} anchoredAt={b.anchoredAt} mode={b.mode} />
        <p className="mt-5 flex items-start gap-2.5 border-t border-line pt-4 text-[13px] leading-relaxed text-ink-2">
          <IconQuestion size={15} className="mt-0.5 shrink-0" />
          <span>
            <strong className="font-medium text-ink">Discovery time is claimed by the company.</strong> The chain proves when the
            notice was sealed, not when the breach was really found.
          </span>
        </p>
      </section>

      <section aria-labelledby={`p46-${b.id}`}>
        <div className="flex items-baseline justify-between gap-3">
          <h3 id={`p46-${b.id}`} className="text-[15px] font-semibold text-ink">
            UU PDP Pasal 46 notice
          </h3>
          {b.affectedCount !== null ? (
            <span className="tnum text-[13px] text-ink-3">{b.affectedCount.toLocaleString('en-US')} people affected</span>
          ) : null}
        </div>
        <dl className="mt-4 grid grid-cols-1 border-b border-line sm:grid-cols-2">
          {PASAL46.map((f, i) => (
            <div
              key={f.key}
              className={`border-t border-line py-4 ${i % 2 ? 'sm:border-l sm:pl-5' : 'sm:pr-5'}`}
            >
              <dt className="text-[13px] text-ink-3">{f.label}</dt>
              <dd className="mt-2 text-[15px] leading-relaxed text-ink">{b.pasal46[f.key]}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-label="Sealed record" className="rounded-lg border border-line bg-card px-5 pt-2 lg:px-6">
        <dl>
          <Fact k="Notice sealed">{sealedPhrase(b.anchoredAt)}</Fact>
          <Fact k="Discovery claimed">{plainTime(b.detectedAt * 1000)}</Fact>
          <Fact k="Legal grounding">UU PDP Pasal 46 · notify within 3×24 hours</Fact>
          <Fact k="Notice content" tone={b.noticeHashMatches === false ? 'bad' : b.noticeHashMatches === true ? 'ok' : undefined}>
            {b.noticeHashMatches === true
              ? 'Matches the sealed notice'
              : b.noticeHashMatches === false
                ? 'Changed after sealing'
                : 'On time or late comes from the contract'}
          </Fact>
          {b.ai ? <Fact k="Drafted with">AI draft, provenance sealed in the notice</Fact> : null}
        </dl>
        <TechnicalProof>
          <ProofLine k="Contract" href={b.contract ? explorerLink('address', b.contract) : undefined} hrefLabel={`Open contract on ${EXPLORER_HOST} (new tab)`}>
            {b.contract ? shortHex(b.contract, 6, 4) : 'Not configured here'}
          </ProofLine>
          <ProofLine
            k="Discovery tx"
            href={b.discoveryTxHash ? explorerLink('tx', b.discoveryTxHash) : undefined}
            hrefLabel={`Open discovery transaction on ${EXPLORER_HOST} (new tab)`}
          >
            {b.discoveryTxHash ? shortHex(b.discoveryTxHash, 6, 4) : 'Inside the notice tx'}
          </ProofLine>
          <ProofLine k="Notice tx" href={b.txHash ? explorerLink('tx', b.txHash) : undefined} hrefLabel={`Open notice transaction on ${EXPLORER_HOST} (new tab)`}>
            {b.txHash ? shortHex(b.txHash, 6, 4) : 'None'}
          </ProofLine>
          {b.reportHash ? <ProofLine k="Notice hash">{shortHex(b.reportHash, 6, 4)}</ProofLine> : null}
          {b.ai ? <ProofLine k="AI output">{shortHex(b.ai.outputHash, 6, 4)}</ProofLine> : null}
          <ProofLine k="Network">{CHAIN_NAME}</ProofLine>
          <ProofLine k="Notice id">{b.id.toUpperCase()}</ProofLine>
        </TechnicalProof>
      </section>

      <div className="no-print flex flex-col gap-3">
        <div className="flex flex-wrap gap-3">
          {b.txHash ? (
            <ButtonLink href={explorerLink('tx', b.txHash)} external variant="dark" arrow icon={<IconExternal size={16} />}>
              Open the public ledger
            </ButtonLink>
          ) : null}
          <Button variant="light" icon={<IconDownload size={16} />} onClick={onExport}>
            Export audit PDF
          </Button>
        </div>
        {b.txHash ? <p className="font-mono text-[11px] text-ink-3">{EXPLORER_CAPTION}</p> : null}
      </div>
    </article>
  )
}

export function BreachDetailSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading notice">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-56" />
        <Skeleton className="h-8 w-4/5" />
        <Skeleton className="h-7 w-44" />
      </div>
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-36 w-full" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-56 w-full rounded-xl" />
    </div>
  )
}

/** Loads one notice with getBreach(id) (or the /dev gallery's `load`) and shows loading / not found / error / detail. */
export function BreachDetailLoader({ id, load }: { id: string; load?: (id: string) => Promise<BreachDetailView | null> }) {
  const instance = useId()
  const q = useQuery({
    queryKey: ['breach', id, load ? instance : 'live'],
    queryFn: () => (load ?? getBreach)(id),
    retry: false,
    refetchInterval: load ? false : 10_000,
    refetchIntervalInBackground: false,
  })

  const onRetry = () => void q.refetch()

  if (q.isPending) return <BreachDetailSkeleton />
  // A failed poll keeps the notice already on screen.
  if (q.isError && !q.data) {
    return (
      <Quiet
        glyph="eye"
        title="Couldn’t load this notice"
        body={`${q.error.message} Nothing is decided until it loads.`}
        action={
          <Button variant="light" size="sm" icon={<IconRefresh size={15} />} onClick={onRetry}>
            Try again
          </Button>
        }
      />
    )
  }
  if (!q.data) {
    return <Quiet glyph="clock" title="Notice not found" body="It may not be sealed yet, or the link is wrong." />
  }
  return <BreachDetail b={q.data} />
}
