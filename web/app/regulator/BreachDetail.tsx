'use client'

import { useQuery } from '@tanstack/react-query'
import { useId, type ReactNode } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button, ButtonLink } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { FingerprintChip } from '@/components/ui/FingerprintChip'
import { IconAlert, IconArrowUpRight, IconCheck, IconClock, IconDownload, IconExternal, IconQuestion, IconRefresh, IconX } from '@/components/ui/icons'
import { RegMarks } from '@/components/ui/RegMarks'
import { Skeleton } from '@/components/ui/Skeleton'
import { Timeline72 } from '@/components/ui/Timeline72'
import { explorerLink, getBreach, type BreachDetailView } from '@/lib/data'
import { formatWIB } from '@/lib/format'
import type { BreachRow } from '@/lib/shared/types'

export function breachBadge(b: BreachRow, size: 'sm' | 'md' = 'sm') {
  return b.mode === 'late' ? (
    <Badge kind="LATE" suffix={`${Math.round(b.lateBySec / 3600)} H`} size={size} />
  ) : (
    <Badge kind="ON_TIME" suffix={`${Math.round(b.hoursUsed)} H`} size={size} />
  )
}

const PASAL46: { key: keyof BreachDetailView['pasal46']; label: string }[] = [
  { key: 'dataAffected', label: '(a) Data affected' },
  { key: 'whenAndHow', label: '(b) When and how' },
  { key: 'actionsTaken', label: '(c) Actions taken' },
  { key: 'contact', label: '(d) Contact for citizens' },
]

/** One line of the on-chain proof slab: value + copy, and an explorer link when there is one. */
function ProofLine({ k, children, href, hrefLabel }: { k: string; children: ReactNode; href?: string; hrefLabel?: string }) {
  return (
    <div className="flex min-h-11 items-center gap-3 border-b border-vault-line py-1 last:border-b-0">
      <dt className="label w-32 shrink-0 text-[11px] text-vault-ink-2">{k}</dt>
      <dd className="flex flex-1 items-center justify-end gap-1">
        {children}
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            aria-label={hrefLabel}
            className="-my-2.5 -mr-2.5 flex h-11 w-11 items-center justify-center rounded-sm text-vault-ink-2 transition-colors hover:bg-vault-2 hover:text-ice"
          >
            <IconArrowUpRight size={15} />
          </a>
        ) : null}
      </dd>
    </div>
  )
}

export function BreachDetail({ b }: { b: BreachDetailView }) {
  const late = b.mode === 'late'

  const onExport = () => window.print()

  return (
    <article className="flex flex-col gap-6" aria-labelledby={`b-${b.id}`}>
      <div>
        <p className="label text-ink-2">
          {b.controllerName} · <span className="text-ink">{b.id.toUpperCase()}</span>
        </p>
        <h2 id={`b-${b.id}`} className="mt-2 text-[26px] font-medium leading-tight tracking-[-0.03em] text-ink">
          {b.title}
        </h2>
        <div className="mt-3">
          {late ? (
            <Badge kind="LATE" suffix={`BY ${Math.round(b.lateBySec / 3600)} H · ${Math.round(b.hoursUsed)} H OF 72 H`} />
          ) : (
            <Badge kind="ON_TIME" suffix={`${b.hoursUsed.toFixed(1)} H OF 72 H`} />
          )}
        </div>
      </div>

      <div className="rounded-lg border border-line bg-card px-5 pb-4 pt-6">
        <Timeline72 detectedAt={b.detectedAt} anchoredAt={b.anchoredAt} mode={b.mode} />
        <p className="mt-4 flex items-start gap-2 border-t border-dashed border-line pt-3 text-[13px] leading-relaxed text-ink-2">
          <IconQuestion size={15} className="mt-0.5 shrink-0" />
          <span>
            <strong className="font-medium text-ink">Discovery time is claimed by the company.</strong> The chain proves when the
            notice was sealed, not when the breach was really found.
          </span>
        </p>
      </div>

      <section aria-labelledby={`p46-${b.id}`} className="overflow-hidden rounded-lg border border-line bg-card">
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
          <h3 id={`p46-${b.id}`} className="label text-ink">
            UU PDP Art. 46 notice
          </h3>
          {b.affectedCount !== null ? (
            <span className="label tnum text-[11px] text-ink-2">{b.affectedCount.toLocaleString('en-US')} people affected</span>
          ) : null}
        </div>
        <dl className="grid grid-cols-1 gap-px bg-line sm:grid-cols-2">
          {PASAL46.map((f) => (
            <div key={f.key} className="bg-card p-4">
              <dt className="label text-[11px] text-ink-2">{f.label}</dt>
              <dd className="mt-1.5 text-[14px] leading-relaxed text-ink">{b.pasal46[f.key]}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="vault grain relative rounded-xl border border-vault-line bg-vault p-5 text-vault-ink" aria-label="On-chain proof">
        <RegMarks className="bg-ice" />
        <div className="relative z-[1]">
          <p className="label text-ice">On-chain proof</p>
          <dl className="mt-3 flex flex-col">
            <ProofLine
              k="CONTRACT"
              href={b.contract ? explorerLink('address', b.contract) : undefined}
              hrefLabel="Open contract on the explorer (new tab)"
            >
              {b.contract ? (
                <FingerprintChip value={b.contract} kind="none" onVault label="contract address" />
              ) : (
                <span className="text-right font-mono text-[12px] text-vault-ink-2">Not configured on this deployment</span>
              )}
            </ProofLine>
            <ProofLine
              k="DISCOVERY TX"
              href={b.discoveryTxHash ? explorerLink('tx', b.discoveryTxHash) : undefined}
              hrefLabel="Open discovery transaction on the explorer (new tab)"
            >
              {b.discoveryTxHash ? (
                <FingerprintChip value={b.discoveryTxHash} kind="none" onVault label="discovery transaction" />
              ) : (
                <span className="text-right font-mono text-[12px] text-vault-ink-2">
                  {formatWIB(b.detectedAt * 1000)} · sealed inside notice tx
                </span>
              )}
            </ProofLine>
            <ProofLine
              k="NOTICE TX"
              href={b.txHash ? explorerLink('tx', b.txHash) : undefined}
              hrefLabel="Open notice transaction on the explorer (new tab)"
            >
              <FingerprintChip value={b.txHash} kind="none" onVault label="notice transaction" />
            </ProofLine>
            {b.reportHash ? (
              <ProofLine k="NOTICE HASH">
                <FingerprintChip value={b.reportHash} kind="none" onVault label="notice hash" />
              </ProofLine>
            ) : null}
            {b.ai ? (
              <ProofLine k="AI DRAFT">
                <span className="text-right font-mono text-[12px] text-vault-ink-2">{b.ai.model} · provenance sealed in notice</span>
              </ProofLine>
            ) : null}
          </dl>
          {b.noticeHashMatches === true ? (
            <p className="label mt-3 flex items-center gap-1.5 text-[11px] text-ok-v">
              <IconCheck size={13} strokeWidth={2.6} /> Notice hash matches the sealed report
            </p>
          ) : b.noticeHashMatches === false ? (
            <p className="label mt-3 flex items-center gap-1.5 text-[11px] text-bad-v">
              <IconX size={13} strokeWidth={2.6} /> Notice hash does not match the sealed report
            </p>
          ) : (
            <p className="label mt-3 flex items-center gap-1.5 text-[11px] text-unknown-v">
              <IconQuestion size={13} strokeWidth={2.4} /> On time / late and the seal time come from the contract event
            </p>
          )}
        </div>
      </section>

      <div className="no-print flex flex-wrap gap-3">
        {b.txHash ? (
          <ButtonLink href={explorerLink('tx', b.txHash)} external variant="dark" arrow icon={<IconExternal size={16} />}>
            Open on Etherscan
          </ButtonLink>
        ) : null}
        <Button variant="light" icon={<IconDownload size={16} />} onClick={onExport}>
          Export audit PDF
        </Button>
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
      <Skeleton className="h-44 w-full" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-56 w-full rounded-xl" />
    </div>
  )
}

/** Loads one notice with getBreach(id) (or the /dev gallery's `load`) and shows loading / not found / error / detail. */
export function BreachDetailLoader({ id, load }: { id: string; load?: (id: string) => Promise<BreachDetailView | null> }) {
  const instance = useId()
  const q = useQuery({ queryKey: ['breach', id, load ? instance : 'live'], queryFn: () => (load ?? getBreach)(id), retry: false })

  const onRetry = () => void q.refetch()

  if (q.isPending) return <BreachDetailSkeleton />
  if (q.isError) {
    return (
      <EmptyState
        icon={<IconAlert size={20} />}
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
    return <EmptyState icon={<IconClock size={20} />} title="Notice not found" body="It may not be sealed yet, or the link is wrong." />
  }
  return <BreachDetail b={q.data} />
}
