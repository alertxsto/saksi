'use client'

import Link from 'next/link'
import { Cta } from '@/components/landing/Cta'
import { Badge, receiptBadgeKind, toneClasses } from '@/components/ui/Badge'
import { DotIcon, type DotIconName } from '@/components/ui/DotIcon'
import { IconAlert, IconArrow, IconArrowUpRight, IconCheck } from '@/components/ui/icons'
import type { AutoVerdict, GhostReceipt } from '@/lib/data'
import { actSentence, formatWIB, proofPath, timeAgo } from '@/lib/format'
import type { ReceiptOpening } from '@/lib/shared/types'
import { Scramble } from './motion'

/** Event type → dot glyph (READ / UPDATE / EXPORT / SHARE). */
export const EVENT_GLYPH: readonly DotIconName[] = ['eye', 'edit', 'export', 'share']

const who = (o: Pick<ReceiptOpening, 'controllerName'>) => o.controllerName.replace(' (fictional)', '')

/** Chain status badge. FAILED is a network/chain failure, not tampering, so it stays neutral (red = tamper only). */
function StatusBadge({ opening }: { opening: ReceiptOpening }) {
  if (opening.status === 'failed') {
    return (
      <span className={`inline-flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-sm border px-2 font-mono text-[12px] font-bold tracking-[0.03em] ${toneClasses('unknown')}`}>
        <IconAlert size={14} strokeWidth={2.2} />
        <span>NOT SEALED</span>
      </span>
    )
  }
  return <Badge kind={receiptBadgeKind(opening.status)} size="sm" />
}

/** Small mono note next to the badge for the background auto-verify. */
function VerdictNote({ verdict }: { verdict?: AutoVerdict }) {
  if (!verdict) return null
  if (verdict === 'verifying')
    return (
      <span className="label flex items-center gap-1.5 text-[11px] text-ink-2">
        <span aria-hidden="true" className="cz-blink h-1.5 w-1.5 rounded-full bg-ink-2" />
        Checking
      </span>
    )
  if (verdict === 'match')
    return (
      <span className="label flex items-center gap-1 text-[11px] text-ok">
        <IconCheck size={13} strokeWidth={2.4} /> Checked
      </span>
    )
  if (verdict === 'not_found') return <span className="label text-[11px] text-ink-2">Not on this node yet</span>
  return null
}

/**
 * One receipt in the hairline list. No card: a row on the paper with a dot glyph, who + verb, purpose ·
 * time, then the chain badge. `isNew` slides it in with a blue rail and a scrambled "NEW" label.
 * `verdict` comes from the auto-verify; 'altered' turns the row red once (flash + 4 px shake), swaps
 * the badge to ALTERED and deep-links into the comparison (?check=1 re-runs the check on open).
 */
export function ReceiptRow({
  opening,
  now,
  isNew,
  verdict,
}: {
  opening: ReceiptOpening
  now: number
  isNew?: boolean
  verdict?: AutoVerdict
}) {
  const altered = verdict === 'altered'
  const href = `/citizen/receipt/${opening.eventId}${altered ? '?check=1' : ''}`
  return (
    <Link
      href={href}
      data-verdict={verdict ?? 'none'}
      className={`group relative -mx-2 flex gap-3.5 rounded-lg px-2 py-4 transition-colors duration-150 ${
        altered ? 'cz-tamper' : isNew ? 'cz-row-in bg-blue-bg/45' : 'hover:bg-card'
      }`}
    >
      {altered || isNew ? (
        <span aria-hidden="true" className={`absolute inset-y-3 left-0 w-[3px] rounded-pill ${altered ? 'bg-bad' : 'bg-blue'}`} />
      ) : null}
      <span
        aria-hidden="true"
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-md transition-colors duration-300 ${
          altered ? 'bg-bad-bg text-bad' : opening.eventType === 3 ? 'bg-vault text-ice' : 'bg-paper-2 text-ink'
        }`}
      >
        <DotIcon name={altered ? 'cross' : (EVENT_GLYPH[opening.eventType] ?? 'eye')} size={22} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] leading-snug text-ink">
          {who(opening)} <strong className="font-semibold">{actSentence(opening.eventType)}</strong>
        </span>
        {altered ? (
          <span className="mt-1 block font-mono text-[12px] font-medium text-bad">
            Changed after it was sealed · {now ? timeAgo(opening.createdAt, now) : '—'}
          </span>
        ) : (
          <span className="mt-1 block truncate font-mono text-[12px] text-ink-2">
            {opening.purposeText} · {now ? timeAgo(opening.createdAt, now) : '—'}
          </span>
        )}
        <span className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {altered ? <Badge kind="ALTERED" size="sm" /> : <StatusBadge opening={opening} />}
          <VerdictNote verdict={verdict} />
          {isNew && !altered ? (
            <span className="label flex items-center gap-1.5 text-[11px] text-blue">
              <span className="h-1.5 w-1.5 rounded-full bg-blue" aria-hidden="true" />
              <Scramble value="NEW · JUST ARRIVED" onMount />
            </span>
          ) : null}
        </span>
      </span>
      <IconArrow
        size={15}
        aria-hidden="true"
        className={`mt-1 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 ${altered ? 'text-bad' : 'text-ink-3 group-hover:text-blue'}`}
      />
    </Link>
  )
}

/**
 * DELETED ghost: a receipt the phone remembers but the company's database no longer returns. Grey,
 * dashed (it is an absence), with the red DELETED badge and a red strike through what they did.
 */
export function GhostRow({ ghost, now }: { ghost: GhostReceipt; now: number }) {
  const o = ghost.opening
  return (
    <article
      aria-label={`Deleted record: ${who(o)} ${actSentence(o.eventType)}`}
      className="cz-tamper-soft relative rounded-lg border border-dashed border-line-strong bg-paper-2/70 p-4"
    >
      <div className="flex gap-3.5">
        <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-dashed border-line-strong text-ink-3">
          <DotIcon name={EVENT_GLYPH[o.eventType] ?? 'eye'} size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] leading-snug text-ink-3 line-through decoration-bad decoration-[1.5px]">
            {who(o)} {actSentence(o.eventType)}
          </p>
          <p className="mt-1 font-mono text-[12px] leading-snug text-ink-3">
            {o.purposeText} · sealed {now ? timeAgo(o.createdAt, now) : formatWIB(o.createdAt)}
          </p>
          <Badge kind="DELETED" size="sm" className="mt-2.5" />
        </div>
      </div>
      <p className="mt-3 border-t border-line pt-3 text-[14px] leading-relaxed text-ink">
        <span className="text-bad">This record disappeared from the company&apos;s database.</span>{' '}
        <strong className="font-semibold">The chain still has it.</strong>
      </p>
      <p className="mt-2 font-mono text-[12px] leading-snug text-ink-2">
        Seen in the database {now ? timeAgo(new Date(ghost.lastSeenAt).toISOString(), now) : 'earlier'} · missing now · still sealed on chain
      </p>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
        <Link
          href={proofPath(o)}
          className="label -ml-1 flex min-h-11 items-center gap-1.5 px-1 text-[12px] text-ink hover:text-blue"
        >
          View on-chain proof <IconArrowUpRight size={14} />
        </Link>
      </div>
    </article>
  )
}

/**
 * The phone turned red (riset-ui/26 C1): a tinted block at the top whose headline is the count, one
 * line of provenance above it and a single dark "See what changed". Arrives once (height + one shake);
 * reduced motion: just there.
 */
export function TamperBanner({
  altered,
  deleted,
  checked,
  href,
}: {
  altered: number
  deleted: number
  /** Receipts the phone has finished checking (for "Your phone checked N receipts just now"). */
  checked: number
  href: string | null
}) {
  if (altered + deleted === 0) return null
  const count = altered > 0 ? `${altered} record${altered === 1 ? '' : 's'}` : `${deleted} record${deleted === 1 ? '' : 's'}`
  const rest =
    altered > 0
      ? `${altered === 1 ? 'was' : 'were'} changed after ${altered === 1 ? 'it was' : 'they were'} sealed`
      : `disappeared from the company's database`
  return (
    <div className="cz-banner">
      <section role="alert" aria-label="Tampering detected" className="cz-banner-box rounded-xl border border-bad/25 bg-bad-bg p-4">
        <p className="text-[26px] font-medium leading-[1.1] tracking-[-0.02em] text-ink">
          <span className="text-bad">{count}</span> {rest}
        </p>
        {altered > 0 && deleted > 0 ? (
          <p className="mt-2 text-[16px] leading-[1.6] tracking-[0.01em] text-ink-2">
            And {deleted} record{deleted === 1 ? '' : 's'} disappeared from the company&apos;s database.
          </p>
        ) : null}
        <p className="mt-2 flex items-start gap-2 text-[14px] leading-relaxed text-ink-2">
          <DotIcon name="cross" size={16} className="mt-[3px] shrink-0 text-bad" />
          <span>
            {checked > 0 ? `Your phone checked ${checked} receipt${checked === 1 ? '' : 's'} against the chain just now` : 'Your phone checked the chain'}
            , not Saksi&apos;s server.
          </span>
        </p>
        {href ? (
          <Cta href={href} className="mt-4 w-full justify-between">
            See what changed
          </Cta>
        ) : null}
      </section>
    </div>
  )
}

/**
 * Optional amber card for a receipt whose fingerprint is not sealed yet (pending / submitted).
 */
export function WaitingForChain({ className = '' }: { className?: string }) {
  return (
    <section aria-label="Waiting for the chain" className={`flex gap-3.5 rounded-lg border border-pending/30 bg-pending-bg p-4 text-pending ${className}`}>
      <span aria-hidden="true" className="cz-blink-soft flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-pending/12">
        <DotIcon name="clock" size={22} />
      </span>
      <div className="min-w-0">
        <p className="text-[16px] font-medium leading-snug">Waiting for the chain</p>
        <p className="mt-1 text-[14px] leading-relaxed text-ink-2">
          The company logged this access. Its fingerprint is being sealed now; checking works once it shows{' '}
          <span className="font-mono text-[12px] font-bold text-ok">RECORDED</span>.
        </p>
      </div>
    </section>
  )
}
