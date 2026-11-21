import Link from 'next/link'
import type { ReceiptOpening } from '@/lib/shared/types'
import { actSentence, timeAgo } from '@/lib/format'
import { Badge, receiptBadgeKind } from './Badge'
import { IconArrow, IconDownload, IconEye, IconPlus, IconShare } from './icons'

const TILE_ICONS = [IconEye, IconPlus, IconDownload, IconShare]

/** Citizen receipt card: icon tile + who + bold verb + meta + status badge. */
export function ReceiptCard({ opening, now, isNew }: { opening: ReceiptOpening; now: number; isNew?: boolean }) {
  const Icon = TILE_ICONS[opening.eventType] ?? IconEye
  const sharing = opening.eventType === 3
  const who = opening.controllerName.replace(' (fictional)', '')
  return (
    <Link
      href={`/citizen/receipt/${opening.eventId}`}
      className={`group relative flex gap-3.5 rounded-lg border bg-card p-4 transition-colors hover:border-ink ${
        isNew ? 'anim-arrive border-2 border-blue bg-blue-bg/35 p-[15px]' : 'border-line'
      }`}
    >
      <span
        aria-hidden="true"
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-sm ${sharing ? 'bg-ink text-ice' : 'bg-paper-2 text-ink'}`}
      >
        <Icon size={19} />
      </span>
      <span className="min-w-0 flex-1">
        {isNew ? (
          <span className="label mb-1.5 flex items-center gap-1.5 text-blue">
            <span className="h-1.5 w-1.5 rounded-full bg-blue" aria-hidden="true" />
            NEW · JUST ARRIVED
          </span>
        ) : null}
        <span className="block text-[15px] leading-snug text-ink">
          {who} <strong className="font-semibold">{actSentence(opening.eventType)}</strong>
        </span>
        <span className="mt-1 block truncate font-mono text-[12px] text-ink-2">
          {opening.purposeText} · {now ? timeAgo(opening.createdAt, now) : '—'}
        </span>
        <span className="mt-3 flex items-center justify-between gap-2">
          <Badge kind={receiptBadgeKind(opening.status)} size="sm" />
          <span className="label flex items-center gap-1 text-ink-2 transition-colors group-hover:text-blue">
            Details <IconArrow size={13} />
          </span>
        </span>
      </span>
    </Link>
  )
}
