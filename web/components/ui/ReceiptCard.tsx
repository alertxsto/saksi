import Link from 'next/link'
import type { ReceiptOpening } from '@/lib/shared/types'
import { timeAgo } from '@/lib/format'
import { IDLE, receiptHeadline, type ReceiptCheck } from '@/lib/receipt-state'
import { Badge } from './Badge'
import { IconArrow, IconDownload, IconEye, IconPlus, IconShare } from './icons'

const TILE_ICONS = [IconEye, IconPlus, IconDownload, IconShare]

/**
 * Citizen receipt card: icon tile + who + bold verb + meta + status badge. `check` is this browser's
 * chain check for the receipt: once it says ALTERED the card turns red and the verb is the one the
 * chain sealed, with the database's version struck through.
 */
export function ReceiptCard({
  opening,
  now,
  isNew,
  check = IDLE,
}: {
  opening: ReceiptOpening
  now: number
  isNew?: boolean
  check?: ReceiptCheck
}) {
  const head = receiptHeadline(opening, check)
  const altered = head.kind === 'ALTERED'
  const Icon = TILE_ICONS[head.eventType] ?? IconEye
  const sharing = head.eventType === 3
  return (
    <Link
      href={`/citizen/receipt/${opening.eventId}`}
      className={`group relative flex gap-3.5 rounded-lg border bg-card p-4 transition-colors hover:border-ink ${
        altered
          ? 'anim-shake border-2 border-bad bg-bad-bg p-[15px]'
          : isNew
            ? 'anim-arrive border-2 border-blue bg-blue-bg/35 p-[15px]'
            : 'border-line'
      }`}
    >
      <span
        aria-hidden="true"
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-sm ${
          altered ? 'bg-bad text-white' : sharing ? 'bg-ink text-ice' : 'bg-paper-2 text-ink'
        }`}
      >
        <Icon size={19} />
      </span>
      <span className="min-w-0 flex-1">
        {altered ? (
          <span className="label mb-1.5 flex items-center gap-1.5 text-bad">
            <span className="h-1.5 w-1.5 rounded-full bg-bad" aria-hidden="true" />
            RECORD ALTERED · CHAIN DISAGREES
          </span>
        ) : isNew ? (
          <span className="label mb-1.5 flex items-center gap-1.5 text-blue">
            <span className="h-1.5 w-1.5 rounded-full bg-blue" aria-hidden="true" />
            NEW · JUST ARRIVED
          </span>
        ) : null}
        <span className="block text-[15px] leading-snug text-ink">
          {head.who} <strong className={`font-semibold ${head.source === 'chain' ? 'text-bad' : ''}`}>{head.act}</strong>
        </span>
        {head.claimed ? (
          <span className="mt-1 block font-mono text-[12px] text-bad">
            Database says: <span className="line-through decoration-2">{head.claimed}</span>
          </span>
        ) : null}
        <span className="mt-1 block truncate font-mono text-[12px] text-ink-2">
          {opening.purposeText} · {now ? timeAgo(opening.createdAt, now) : '—'}
        </span>
        <span className="mt-3 flex items-center justify-between gap-2">
          <Badge kind={head.kind} size="sm" />
          <span className={`label flex items-center gap-1 transition-colors group-hover:text-blue ${altered ? 'text-bad' : 'text-ink-2'}`}>
            {altered ? 'See evidence' : 'Details'} <IconArrow size={13} />
          </span>
        </span>
      </span>
    </Link>
  )
}

