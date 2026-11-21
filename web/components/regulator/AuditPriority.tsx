'use client'

import { useQuery } from '@tanstack/react-query'
import { AiChip, FALLBACK_LABEL } from '@/components/ui/AiPanel'
import { Button } from '@/components/ui/Button'
import { IconRefresh } from '@/components/ui/icons'
import { Skeleton } from '@/components/ui/Skeleton'
import { getAuditPriority, type AuditItemWire, type AuditPriorityWire, type AuditSignalCode } from '@/lib/data'
import { useLang } from '@/lib/client/lang'

const SIGNAL_LABEL: Record<AuditSignalCode, string> = {
  tampered: 'Changed after sealing',
  lateBreach: 'Late breach notices',
  openReports: 'Open citizen reports',
  outward: 'Exports and shares',
  burst: 'Burst in 10 min',
  offHours: 'Night-time access',
  slowSeal: 'Sealed late',
  staleDrafts: 'Never sealed',
}

const LEVEL: Record<'high' | 'medium', { label: string; chip: string; bar: string }> = {
  high: { label: 'High priority', chip: 'bg-bad-bg text-bad border-bad/25', bar: 'bg-bad' },
  medium: { label: 'Medium priority', chip: 'bg-pending-bg text-pending border-pending/25', bar: 'bg-pending' },
}

function Row({ item, rank }: { item: AuditItemWire; rank: number }) {
  const level = LEVEL[item.level === 'high' ? 'high' : 'medium']
  return (
    <li className="relative flex flex-col gap-2.5 px-4 py-4 lg:px-5">
      <span aria-hidden="true" className={`absolute inset-y-3 left-0 w-[3px] rounded-r ${level.bar}`} />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="font-mono text-[12px] text-ink-3">{String(rank).padStart(2, '0')}</span>
        <span className="min-w-0 text-[15px] font-medium leading-snug text-ink">{item.name}</span>
        <span className={`inline-flex h-6 items-center whitespace-nowrap rounded-pill border px-2 text-[12px] font-medium ${level.chip}`}>{level.label}</span>
        <span className="tnum ml-auto whitespace-nowrap text-[12px] text-ink-3">
          <span>Score</span> {item.score}/100
        </span>
      </div>
      <ul className="flex flex-wrap gap-1.5" aria-label="Signals">
        {item.signals.map((s) => (
          <li key={s.code} className="inline-flex h-7 items-center gap-1.5 rounded-pill border border-line bg-paper-2 px-2.5 text-[12px] text-ink-2">
            <span>{SIGNAL_LABEL[s.code]}</span>
            <span className="tnum font-medium text-ink" data-no-translate>
              {s.total !== undefined ? `${s.value}/${s.total}` : s.value}
            </span>
          </li>
        ))}
      </ul>
      {item.reason ? (
        <p className="max-w-[72ch] text-[14px] leading-relaxed text-ink-2" data-no-translate>
          {item.reason}
        </p>
      ) : null}
      {item.nextStep ? (
        <p className="max-w-[72ch] text-[14px] leading-relaxed text-ink">
          <span className="label mr-2 text-[11px] text-ai">Next step</span>
          <span data-no-translate>{item.nextStep}</span>
        </p>
      ) : null}
    </li>
  )
}

/**
 * Audit priority: which agencies to look at first. Code scores every agency from what Saksi witnessed (tampering
 * found by Watch, late breach notices, open reports, exports and shares, bursts, night-time access, slow sealing,
 * unsealed drafts); the AI only words the reason and one next step, in the screen language. The AI text is
 * marked data-no-translate because it already comes back in the right language.
 */
export function AuditPriority({ load }: { load?: () => Promise<AuditPriorityWire> }) {
  const lang = useLang()
  const q = useQuery({
    queryKey: ['audit-priority', load ? 'dev' : lang],
    queryFn: load ?? (() => getAuditPriority(lang)),
    retry: 1,
    refetchInterval: load ? false : 60_000,
    refetchIntervalInBackground: false,
  })
  const data = q.data
  const flagged = data ? data.items.filter((i) => i.level !== 'low').slice(0, 6) : []

  return (
    <section aria-labelledby="ap-h" className="flex min-w-0 flex-col gap-3">
      <div className="flex min-h-8 flex-wrap items-center justify-between gap-3">
        <h2 id="ap-h" className="text-[15px] font-semibold text-ink">
          Audit priority
        </h2>
        <span className="flex flex-wrap items-center gap-2">
          {data && data.ai.fallbackLevel !== 'primary' ? <span className="label text-[11px] text-ink-3">{FALLBACK_LABEL[data.ai.fallbackLevel]}</span> : null}
          <AiChip meta={data?.ai} />
        </span>
      </div>

      {q.isPending ? (
        <div className="flex flex-col gap-3 rounded-lg border border-line bg-card px-5 py-5" aria-busy="true">
          <p className="text-[14px] text-ink-2">Scoring every agency, then asking the AI to explain the top of the list…</p>
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-3/5" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : q.isError && !data ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-line-strong px-4 py-4">
          <p className="text-[14px] text-ink-2">Audit priority did not load. Nothing is decided.</p>
          <Button variant="light" size="sm" icon={<IconRefresh size={15} />} onClick={() => void q.refetch()}>
            Try again
          </Button>
        </div>
      ) : data ? (
        <div className="overflow-hidden rounded-lg border border-line bg-card">
          <p className="border-b border-line bg-ai-bg/40 px-4 py-3.5 text-[14px] leading-relaxed text-ink lg:px-5" data-no-translate>
            {data.summary}
          </p>
          {flagged.length ? (
            <ol className="divide-y divide-line">
              {flagged.map((item, i) => (
                <Row key={item.id} item={item} rank={i + 1} />
              ))}
            </ol>
          ) : (
            <p className="px-4 py-4 text-[14px] text-ink-2 lg:px-5">No agency stands out. Every pattern is within the usual range.</p>
          )}
          <p className="border-t border-line px-4 py-3 text-[12px] leading-relaxed text-ink-3 lg:px-5">
            Priority is set by fixed rules from what Saksi witnessed. The AI only words the reason and the next step, and sees agency names and counts, never a citizen. A signal is a reason to look, not proof.
            {!data.watchKnown ? ' Watch could not reach the ledger, so tampering is not counted right now.' : ''}
          </p>
        </div>
      ) : null}
    </section>
  )
}
