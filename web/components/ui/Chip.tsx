import type { ReactNode } from 'react'

/** Outline uppercase chip (ghost.ai style): HASH ONLY ON CHAIN, UU PDP ART. 46 … */
export function Chip({
  children,
  icon,
  tone = 'ink',
  className = '',
}: {
  children: ReactNode
  icon?: ReactNode
  tone?: 'ink' | 'blue' | 'ai' | 'vault' | 'ok' | 'pending'
  className?: string
}) {
  const t = {
    ink: 'border-line-strong text-ink-2',
    blue: 'border-blue/40 text-blue bg-blue-bg/60',
    ai: 'border-ai/40 text-ai bg-ai-bg',
    vault: 'border-vault-line text-vault-ink-2',
    ok: 'border-ok/30 text-ok bg-ok-bg',
    pending: 'border-pending/30 text-pending bg-pending-bg',
  }[tone]
  return (
    <span className={`label inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-pill border px-2.5 ${t} ${className}`}>
      {icon}
      {children}
    </span>
  )
}

/** "01 / RECORD" — mono, ink-3 with the number in blue. */
export function SectionIndex({ n, children, onVault }: { n: string; children: ReactNode; onVault?: boolean }) {
  return (
    <p className={`label ${onVault ? 'text-vault-ink-2' : 'text-ink-2'}`}>
      <span className={onVault ? 'text-ice' : 'text-blue'}>{n}</span>
      <span aria-hidden="true"> / </span>
      {children}
    </p>
  )
}

/** "/FOR CITIZENS" style eyebrow. */
export function Eyebrow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`label text-ink-2 ${className}`}>{children}</p>
}

/** Two-tone headline: head in ink, tail in ink-2. */
export function TwoTone({
  head,
  tail,
  as: Tag = 'h1',
  className = '',
  onVault,
}: {
  head: ReactNode
  tail: ReactNode
  as?: 'h1' | 'h2' | 'h3'
  className?: string
  onVault?: boolean
}) {
  return (
    <Tag className={`display text-balance ${onVault ? 'text-vault-ink' : 'text-ink'} ${className}`}>
      {head} <span className={onVault ? 'text-vault-ink-2' : 'text-ink-2'}>{tail}</span>
    </Tag>
  )
}

/** Live dot: ● with an optional ping ring (motion-safe). */
export function LiveDot({ tone = 'blue', ping = true }: { tone?: 'blue' | 'ok' | 'ice' | 'bad' | 'pending'; ping?: boolean }) {
  const c = { blue: 'bg-blue', ok: 'bg-ok', ice: 'bg-ice', bad: 'bg-bad', pending: 'bg-pending' }[tone]
  return (
    <span className="relative inline-flex h-2 w-2 shrink-0" aria-hidden="true">
      {ping ? <span className={`anim-ping absolute inset-0 rounded-full ${c}`} /> : null}
      <span className={`relative h-2 w-2 rounded-full ${c}`} />
    </span>
  )
}
