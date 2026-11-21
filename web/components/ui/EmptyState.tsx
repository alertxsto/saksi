import type { ReactNode } from 'react'

export function EmptyState({
  icon,
  title,
  body,
  action,
  tone = 'neutral',
}: {
  icon: ReactNode
  title: string
  body?: ReactNode
  action?: ReactNode
  tone?: 'neutral' | 'pending' | 'bad'
}) {
  const tile = {
    neutral: 'bg-paper-2 text-ink-2',
    pending: 'bg-pending-bg text-pending',
    bad: 'bg-bad-bg text-bad',
  }[tone]
  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-line-strong bg-card/60 p-5">
      <span className={`flex h-11 w-11 items-center justify-center rounded-sm ${tile}`}>{icon}</span>
      <div>
        <p className="text-[16px] font-medium leading-snug text-ink">{title}</p>
        {body ? <p className="mt-1 text-[14px] leading-relaxed text-ink-2">{body}</p> : null}
      </div>
      {action}
    </div>
  )
}
