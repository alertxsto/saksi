'use client'

import Link from 'next/link'
import type { SVGProps } from 'react'
import { Cta } from '@/components/landing/Cta'
import { DotIcon, type DotIconName } from '@/components/ui/DotIcon'
import { IconArrowUpRight, IconCheck, IconSpinner, IconX } from '@/components/ui/icons'
import type { AutoVerdict, GhostReceipt } from '@/lib/data'
import { actSentence, formatWIB, proofPath, timeAgo } from '@/lib/format'
import type { ReceiptOpening } from '@/lib/shared/types'

/** Drill-in chevron (rows); same stroke family as components/ui/icons. */
export function IconChevron({ size = 16, ...p }: { size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  )
}

/** Event type → dot glyph (READ / UPDATE / EXPORT / SHARE). */
export const EVENT_GLYPH: readonly DotIconName[] = ['eye', 'edit', 'export', 'share']

const who = (o: Pick<ReceiptOpening, 'controllerName'>) => o.controllerName.replace(' (fictional)', '')

/** Two-letter initials for a company avatar: "Contoh Lending Co." → "CL". */
export function initials(name: string): string {
  const parts = who({ controllerName: name })
    .replace(/[^\p{L}\p{N} ]/gu, ' ')
    .split(' ')
    .filter((p) => p && !/^(co|ltd|inc|pt|tbk)$/i.test(p))
  return ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase()
}

/** Round initials avatar (rows 40, detail hero 56). Tamper turns it red; nothing else colours it. */
export function Avatar({ name, size = 40, tone = 'neutral' }: { name: string; size?: 40 | 56; tone?: 'neutral' | 'bad' | 'ghost' }) {
  const cls =
    tone === 'bad'
      ? 'bg-bad-bg text-bad'
      : tone === 'ghost'
        ? 'border border-dashed border-line-strong text-ink-3'
        : 'bg-paper-2 text-ink'
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold tracking-[-0.01em] ${cls} ${
        size === 56 ? 'h-14 w-14 text-[18px]' : 'h-10 w-10 text-[14px]'
      }`}
    >
      {initials(name)}
    </span>
  )
}

/** Small red tamper pill (Altered / Deleted). The only red in a row. */
export function TamperPill({ children }: { children: string }) {
  return (
    <span className="inline-flex h-6 shrink-0 items-center gap-1 rounded-pill bg-bad-bg px-2.5 text-[13px] font-medium text-bad">
      <IconX size={12} strokeWidth={2.6} aria-hidden="true" />
      {children}
    </span>
  )
}

/**
 * The one status on the right of a row. Verified: a small green check. Sealing: amber text. Tamper: red
 * pill. Not sealed / not on this node: quiet grey text (red is tamper only). Recorded, not checked: nothing.
 */
function RowStatus({ opening, verdict }: { opening: ReceiptOpening; verdict?: AutoVerdict }) {
  if (verdict === 'altered') return <TamperPill>Altered</TamperPill>
  if (opening.status === 'failed') return <span className="text-[13px] text-ink-3">Not sealed</span>
  if (opening.status === 'pending' || opening.status === 'submitted') return <span className="text-[13px] font-medium text-pending">Sealing…</span>
  if (verdict === 'verifying')
    return (
      <span className="flex items-center gap-1.5 text-[13px] text-ink-3">
        <IconSpinner size={13} /> Checking
      </span>
    )
  if (verdict === 'match')
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ok-bg text-ok" title="Matches the chain">
        <IconCheck size={13} strokeWidth={2.6} aria-hidden="true" />
        <span className="sr-only">Matches the chain</span>
      </span>
    )
  if (verdict === 'not_found') return <span className="text-[13px] text-ink-3">Not on this node</span>
  return null
}

/**
 * One receipt in an inset group (riset-ui/35): initials avatar, two lines of text, one status on the right,
 * chevron. `isNew` adds a blue dot before the time and a soft blue wash while it slides in. `verdict`
 * 'altered' flashes the row red once, turns the avatar and the second line red and deep-links into the
 * comparison (?check=1 re-runs the check on open). `selected` marks the receipt open in the laptop pane.
 */
export function ReceiptRow({
  opening,
  now,
  isNew,
  verdict,
  selected = false,
}: {
  opening: ReceiptOpening
  now: number
  isNew?: boolean
  verdict?: AutoVerdict
  /** Open in the laptop detail pane. */
  selected?: boolean
}) {
  const altered = verdict === 'altered'
  const href = `/citizen/receipt/${opening.eventId}${altered ? '?check=1' : ''}`
  const when = now ? timeAgo(opening.createdAt, now) : '—'
  return (
    <Link
      href={href}
      data-verdict={verdict ?? 'none'}
      aria-current={selected ? 'page' : undefined}
      className={`cz-row group relative flex min-h-16 items-center gap-3 pl-4 transition-colors duration-150 ${
        altered ? 'cz-tamper bg-bad-bg/50' : isNew ? 'cz-row-in bg-blue-bg/40' : selected ? 'bg-paper-2/70' : 'hover:bg-paper-2/50'
      } ${selected ? 'ws-row-selected' : ''}`}
    >
      <Avatar name={opening.controllerName} tone={altered ? 'bad' : 'neutral'} />
      <span className="cz-row-main flex min-w-0 flex-1 items-center gap-3 self-stretch py-3 pr-3">
        <span className="min-w-0 flex-1">
          <span className="block text-[16px] font-medium leading-snug text-ink">
            {who(opening)} {actSentence(opening.eventType)}
          </span>
          <span className={`mt-0.5 flex min-w-0 items-center gap-1.5 text-[14px] leading-snug ${altered ? 'text-bad' : 'text-ink-2'}`}>
            {isNew && !altered ? <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue" /> : null}
            <span className="truncate">
              {altered ? 'Changed after it was sealed' : opening.purposeText} · {when}
            </span>
            {isNew && !altered ? <span className="sr-only">, just arrived</span> : null}
          </span>
        </span>
        <RowStatus opening={opening} verdict={verdict} />
        <IconChevron size={16} aria-hidden="true" className={`shrink-0 ${altered ? 'text-bad' : 'text-ink-3 group-hover:text-ink-2'}`} />
      </span>
    </Link>
  )
}

/**
 * DELETED ghost: a receipt the phone remembers but the company's database no longer returns. Same row
 * anatomy on a dashed, sunken surface (it is an absence), red "Deleted" pill, what they did struck through,
 * and the link to the on-chain proof that still exists.
 */
export function GhostRow({ ghost, now }: { ghost: GhostReceipt; now: number }) {
  const o = ghost.opening
  return (
    <article
      aria-label={`Deleted record: ${who(o)} ${actSentence(o.eventType)}`}
      className="cz-tamper-soft overflow-hidden rounded-lg border border-dashed border-line-strong bg-paper-2/60"
    >
      <div className="flex min-h-16 items-center gap-3 px-4 py-3">
        <Avatar name={o.controllerName} tone="ghost" />
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-medium leading-snug text-ink-3 line-through decoration-bad decoration-[1.5px]">
            {who(o)} {actSentence(o.eventType)}
          </p>
          <p className="mt-0.5 truncate text-[14px] leading-snug text-ink-3">
            {o.purposeText} · sealed {now ? timeAgo(o.createdAt, now) : formatWIB(o.createdAt)}
          </p>
        </div>
        <TamperPill>Deleted</TamperPill>
      </div>
      <div className="border-t border-line px-4 pb-1 pt-3">
        <p className="text-[15px] leading-relaxed text-ink">
          <span className="text-bad">This record disappeared from the company&apos;s database.</span>{' '}
          <strong className="font-semibold">The chain still has it.</strong>
        </p>
        <p className="mt-1 text-[13px] leading-snug text-ink-3">
          Seen {now ? timeAgo(new Date(ghost.lastSeenAt).toISOString(), now) : 'earlier'} · missing now · still sealed on chain
        </p>
        <Link href={proofPath(o)} className="-ml-1 flex min-h-11 w-fit items-center gap-1.5 px-1 text-[14px] font-medium text-ink hover:text-blue">
          View on-chain proof <IconArrowUpRight size={14} />
        </Link>
        {o.txHash && o.logIndex !== null ? (
          <Link href={`/citizen/receipt/${o.eventId}`} className="-ml-1 flex min-h-11 w-fit items-center gap-1.5 px-1 text-[14px] font-medium text-ink hover:text-blue">
            Report to the regulator <span aria-hidden="true">›</span>
          </Link>
        ) : null}
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
