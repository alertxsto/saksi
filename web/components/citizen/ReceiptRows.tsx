'use client'

import Link from 'next/link'
import type { CSSProperties, SVGProps } from 'react'
import { Cta } from '@/components/landing/Cta'
import { DotIcon, type DotIconName } from '@/components/ui/DotIcon'
import { IconArrowUpRight, IconCheck, IconSpinner, IconX } from '@/components/ui/icons'
import type { AutoVerdict, GhostReceipt } from '@/lib/data'
import { actSentence, formatWIB, proofPath, timeAgo, timeBucket } from '@/lib/format'
import type { ReceiptOpening } from '@/lib/shared/types'
import '@/app/citizen/stub-list.css'

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
 * `onInk`: the selected (ink-filled) stub on the laptop, where amber and grey need their light variants.
 */
function RowStatus({ opening, verdict, onInk = false }: { opening: ReceiptOpening; verdict?: AutoVerdict; onInk?: boolean }) {
  const quiet = onInk ? 'text-paper/70' : 'text-ink-3'
  if (verdict === 'altered') return <TamperPill>Altered</TamperPill>
  if (opening.status === 'failed') return <span className={`shrink-0 text-[13px] ${quiet}`}>Not sealed</span>
  if (opening.status === 'pending' || opening.status === 'submitted')
    return <span className={`shrink-0 text-[13px] font-medium ${onInk ? 'text-pending-v' : 'text-pending'}`}>Sealing…</span>
  if (verdict === 'verifying')
    return (
      <span className={`flex shrink-0 items-center gap-1.5 text-[13px] ${quiet}`}>
        <IconSpinner size={13} /> Checking
      </span>
    )
  if (verdict === 'match')
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ok-bg text-ok" title="Matches the chain">
        <IconCheck size={13} strokeWidth={2.6} aria-hidden="true" />
        <span className="sr-only">Matches the chain</span>
      </span>
    )
  if (verdict === 'not_found') return <span className={`shrink-0 text-[13px] ${quiet}`}>Not on this node</span>
  return null
}

const WIB = 'Asia/Jakarta'
/** "13:16" in WIB: the time printed on the torn-off side of the stub. */
function clockWIB(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: WIB })
}
/** "Today" for receipts from today (WIB), otherwise "20 Nov". */
function dayWIB(iso: string, now: number): string {
  const d = new Date(iso)
  if (now && timeBucket(iso, now) !== 'EARLIER') return 'Today'
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: WIB })
}
/** Second line of a stub: the verb, short enough to leave room for the purpose. */
const STUB_VERB = ['Read your data', 'Updated your data', 'Exported your data', 'Shared with a third party']
const stubVerb = (eventType: number) => STUB_VERB[eventType] ?? 'Used your data'

/**
 * One receipt as a ticket stub (riset-ui/36 A): the time on the torn-off left side, a perforation, who and
 * what on two lines, one status on the right. `isNew` adds a 6 px blue dot and slides the stub in.
 * `verdict` 'altered' flashes the stub red once, turns the second line red and deep-links into the
 * comparison (?check=1 re-runs the check on open). `selected` (laptop pane open) fills the stub with ink.
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
  const fresh = isNew && !altered
  return (
    <div className={`sl-focus sl-shadow-sm ${fresh ? 'cz-row-in' : ''}`}>
      <Link
        href={href}
        data-verdict={verdict ?? 'none'}
        aria-current={selected ? 'page' : undefined}
        className={`sl-stub group relative flex min-h-[72px] items-stretch overflow-hidden rounded-[16px] transition-colors duration-150 ${
          selected ? 'bg-ink text-paper' : 'bg-card text-ink hover:bg-white'
        }`}
      >
        {altered ? <span aria-hidden="true" className="cz-tamper pointer-events-none absolute inset-0" /> : null}
        <span className="relative flex w-[74px] shrink-0 flex-col items-center justify-center py-3">
          <span className="tnum text-[17px] font-semibold leading-tight tracking-[-0.02em]">{clockWIB(opening.createdAt)}</span>
          <span className={`text-[12px] leading-tight ${selected ? 'text-paper/70' : 'text-ink-2'}`}>{dayWIB(opening.createdAt, now)}</span>
        </span>
        <span aria-hidden="true" className={`sl-perf-v absolute bottom-3 left-[73px] top-3 ${selected ? 'text-paper/30' : 'text-line-strong'}`} />
        <span className="relative flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 pr-3.5">
          <span className="min-w-0 flex-1">
            <span className="flex min-w-0 items-center gap-2">
              {fresh ? <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue" /> : null}
              <span className="truncate text-[16px] font-semibold leading-snug tracking-[-0.01em]">{who(opening)}</span>
              {fresh ? <span className="sr-only">, just arrived</span> : null}
            </span>
            <span
              className={`block truncate text-[14px] leading-snug ${
                altered ? (selected ? 'text-bad-v' : 'text-bad') : selected ? 'text-paper/75' : 'text-ink-2'
              }`}
            >
              {altered ? 'Changed after it was sealed' : `${stubVerb(opening.eventType)} · ${opening.purposeText}`}
            </span>
          </span>
          <RowStatus opening={opening} verdict={verdict} onInk={selected} />
        </span>
      </Link>
    </div>
  )
}

/**
 * DELETED ghost: a receipt the phone remembers but the company's database no longer returns. A torn stub
 * in red: the same time side and perforation, what they did struck through, a red "Deleted" pill, then the
 * explanation and both ways out (the on-chain proof that still exists, and the report to the regulator).
 */
export function GhostRow({ ghost, now }: { ghost: GhostReceipt; now: number }) {
  const o = ghost.opening
  return (
    <div className="cz-tamper-soft sl-shadow-sm rounded-t-[16px]">
      <article aria-label={`Deleted record: ${who(o)} ${actSentence(o.eventType)}`} className="sl-torn relative rounded-t-[16px] bg-bad-bg/70 pb-2 text-ink">
        <div className="relative flex min-h-[72px] items-stretch">
          <span className="flex w-[74px] shrink-0 flex-col items-center justify-center py-3 text-ink-3">
            <span className="tnum text-[17px] font-semibold leading-tight tracking-[-0.02em] line-through decoration-bad decoration-[1.5px]">{clockWIB(o.createdAt)}</span>
            <span className="text-[12px] leading-tight">{dayWIB(o.createdAt, now)}</span>
          </span>
          <span aria-hidden="true" className="sl-perf-v absolute bottom-3 left-[73px] top-3 text-bad/35" />
          <div className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 pr-3.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[16px] font-semibold leading-snug tracking-[-0.01em] text-ink-3 line-through decoration-bad decoration-[1.5px]">{who(o)}</p>
              <p className="truncate text-[14px] leading-snug text-ink-2">
                {o.purposeText} · sealed {now ? timeAgo(o.createdAt, now) : formatWIB(o.createdAt)}
              </p>
            </div>
            <TamperPill>Deleted</TamperPill>
          </div>
        </div>
        <span aria-hidden="true" className="sl-perf mx-4 block text-bad/35" />
        <div className="px-4 pb-2 pt-3">
          <p className="text-[15px] leading-relaxed text-ink">
            <span className="text-bad">This record disappeared from the company&apos;s database.</span>{' '}
            <strong className="font-semibold">The chain still has it.</strong>
          </p>
          <p className="mt-1 text-[13px] leading-snug text-ink-2">
            Seen {now ? timeAgo(new Date(ghost.lastSeenAt).toISOString(), now) : 'earlier'} · missing now · still sealed on chain
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-5">
            <Link href={proofPath(o)} className="-ml-1 flex min-h-11 w-fit items-center gap-1.5 px-1 text-[14px] font-medium text-ink hover:text-blue">
              View on-chain proof <IconArrowUpRight size={14} />
            </Link>
            {o.txHash && o.logIndex !== null ? (
              <Link href={`/citizen/receipt/${o.eventId}`} className="-ml-1 flex min-h-11 w-fit items-center gap-1.5 px-1 text-[14px] font-medium text-ink hover:text-blue">
                Report to the regulator <span aria-hidden="true">›</span>
              </Link>
            ) : null}
          </div>
        </div>
      </article>
    </div>
  )
}

/**
 * The phone turned red (riset-ui/26 C1), as a ticket: the count is the headline on the top half, the
 * provenance and a single dark "See what changed" sit on the tear-off half. Arrives once (height + one
 * shake); reduced motion: just there.
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
      <section role="alert" aria-label="Tampering detected" className="cz-banner-box sl-shadow">
        <div className="sl-ticket rounded-t-xl bg-bad-bg px-5 pb-4 pt-5" style={{ '--notch': '100%' } as CSSProperties}>
          <p className="text-[26px] font-semibold leading-[1.1] tracking-[-0.025em] text-ink">
            <span className="text-bad">{count}</span> {rest}
          </p>
          {altered > 0 && deleted > 0 ? (
            <p className="mt-2 text-[16px] leading-[1.5] text-ink-2">
              And {deleted} record{deleted === 1 ? '' : 's'} disappeared from the company&apos;s database.
            </p>
          ) : null}
        </div>
        <div className="sl-ticket relative rounded-b-xl bg-bad-bg px-5 pb-5 pt-4" style={{ '--notch': '0%' } as CSSProperties}>
          <span aria-hidden="true" className="sl-perf absolute left-5 right-5 top-0 text-bad/40" />
          <p className="flex items-start gap-2 text-[14px] leading-relaxed text-ink-2">
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
        </div>
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
