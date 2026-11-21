import type { ReactNode } from 'react'
import { DotIcon, type DotIconName } from '@/components/ui/DotIcon'

/**
 * Empty / error / not-found block in the landing grammar: a hairline rule, a dot glyph, one sentence
 * and an action. Always neutral (gray): a missing answer is never shown as tampering.
 */
export function Quiet({
  glyph,
  title,
  body,
  action,
  tone = 'neutral',
  className = '',
}: {
  glyph: DotIconName
  title: string
  body?: ReactNode
  action?: ReactNode
  tone?: 'neutral' | 'pending'
  className?: string
}) {
  return (
    <div role={tone === 'pending' ? 'status' : undefined} className={`anim-rise flex items-start gap-4 border-y border-line py-6 ${className}`}>
      <span
        className={`flex size-11 shrink-0 items-center justify-center rounded-md ${tone === 'pending' ? 'bg-pending-bg text-pending' : 'bg-paper-2 text-ink-2'}`}
      >
        <DotIcon name={glyph} size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[18px] font-medium leading-snug tracking-[-0.01em] text-ink">{title}</p>
        {body ? <p className="mt-1.5 max-w-[60ch] text-[14px] leading-relaxed text-ink-2">{body}</p> : null}
        {action ? <div className="mt-4">{action}</div> : null}
      </div>
    </div>
  )
}
