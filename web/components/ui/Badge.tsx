import type { ReactNode } from 'react'
import { IconAlert, IconCheck, IconClock, IconMinus, IconQuestion, IconSpark, IconSpinner, IconX } from './icons'

export type Tone = 'ok' | 'bad' | 'unknown' | 'pending' | 'ai' | 'blue' | 'neutral'

const tones: Record<Tone, string> = {
  ok: 'bg-ok-bg text-ok border-ok/25',
  bad: 'bg-bad-bg text-bad border-bad/30',
  unknown: 'bg-unknown-bg text-unknown border-unknown/25',
  pending: 'bg-pending-bg text-pending border-pending/25',
  ai: 'bg-ai-bg text-ai border-ai/25',
  blue: 'bg-blue-bg text-blue border-blue/25',
  neutral: 'bg-card text-ink-2 border-line-strong',
}

const vaultTones: Record<Tone, string> = {
  ok: 'text-ok-v border-ok-v/40 bg-ok-v/10',
  bad: 'text-bad-v border-bad-v/50 bg-bad-v/10',
  unknown: 'text-unknown-v border-unknown-v/40 bg-unknown-v/10',
  pending: 'text-pending-v border-pending-v/40 bg-pending-v/10',
  ai: 'text-ai-v border-ai-v/40 bg-ai-v/10',
  blue: 'text-ice border-ice/40 bg-ice/10',
  neutral: 'text-vault-ink-2 border-vault-line bg-transparent',
}

export type StatusKind =
  | 'RECORDED'
  | 'ON_CHAIN'
  | 'FAILED'
  | 'MATCH'
  | 'ALTERED'
  | 'NOT_FOUND'
  | 'ON_TIME'
  | 'LATE'
  | 'DELETED'
  | 'NOT_ANCHORED'
  | 'NEW'

const kinds: Record<StatusKind, { tone: Tone; label: string; icon: ReactNode }> = {
  RECORDED: { tone: 'ok', label: 'RECORDED', icon: <IconCheck size={14} strokeWidth={2.4} /> },
  ON_CHAIN: { tone: 'pending', label: 'ON CHAIN', icon: <IconSpinner size={14} strokeWidth={2.4} /> },
  FAILED: { tone: 'bad', label: 'FAILED', icon: <IconAlert size={14} strokeWidth={2.2} /> },
  MATCH: { tone: 'ok', label: 'MATCH', icon: <IconCheck size={14} strokeWidth={2.4} /> },
  ALTERED: { tone: 'bad', label: 'ALTERED', icon: <IconX size={14} strokeWidth={2.4} /> },
  NOT_FOUND: { tone: 'unknown', label: 'NOT FOUND', icon: <IconQuestion size={14} strokeWidth={2.2} /> },
  ON_TIME: { tone: 'ok', label: 'ON TIME', icon: <IconCheck size={14} strokeWidth={2.4} /> },
  LATE: { tone: 'pending', label: 'LATE', icon: <IconClock size={14} strokeWidth={2.2} /> },
  DELETED: { tone: 'bad', label: 'DELETED', icon: <IconMinus size={14} strokeWidth={2.4} /> },
  NOT_ANCHORED: { tone: 'pending', label: 'NOT ANCHORED', icon: <IconAlert size={14} strokeWidth={2.2} /> },
  NEW: { tone: 'blue', label: 'NEW', icon: <IconSpark size={14} strokeWidth={2.2} /> },
}

/** Status badge: icon + mono bold text, never colour alone. */
export function Badge({
  kind,
  suffix,
  onVault,
  size = 'md',
  className = '',
}: {
  kind: StatusKind
  suffix?: string
  onVault?: boolean
  size?: 'md' | 'sm'
  className?: string
}) {
  const k = kinds[kind]
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-sm border font-mono font-bold tracking-[0.03em] ${
        size === 'sm' ? 'h-7 px-2 text-[12px]' : 'h-8 px-2.5 text-[14px]'
      } ${onVault ? vaultTones[k.tone] : tones[k.tone]} ${className}`}
    >
      {k.icon}
      <span>
        {k.label}
        {suffix ? <span className="font-medium"> · {suffix}</span> : null}
      </span>
    </span>
  )
}

/** Map a receipt status to its badge. */
export function receiptBadgeKind(status: 'pending' | 'submitted' | 'anchored' | 'failed'): StatusKind {
  return status === 'anchored' ? 'RECORDED' : status === 'failed' ? 'FAILED' : 'ON_CHAIN'
}

export function toneClasses(tone: Tone, onVault = false) {
  return onVault ? vaultTones[tone] : tones[tone]
}
