import type { CSSProperties } from 'react'
import './entry.css'

/**
 * Who you are, in one chip. Shared by AppHeader, the /enter gate and any workspace sidebar.
 *
 *   <RoleChip actor="agency" identity="Disdukcapil Kota Contoh (fiktif)" />
 *   → [A] Agency · Disdukcapil Kota Contoh (fiktif)
 *
 * One accent per role (riset-ui/37 §3), a tinted disc, never a theme change:
 * citizen ink, agency blue #2A2AE8, regulator green #157F3D.
 */

export type Actor = 'citizen' | 'agency' | 'regulator' | 'verifier' | 'operator'

export const ROLE_META: Record<
  Actor,
  { label: string; initial: string; accent: string; defaultIdentity?: string; home: string; blurb: string }
> = {
  citizen: { label: 'Citizen', initial: 'C', accent: '#1e1a16', home: '/citizen', blurb: 'See every time your data is opened' },
  agency: { label: 'Agency', initial: 'A', accent: '#2a2ae8', home: '/controller', blurb: 'Record access to citizen data' },
  regulator: {
    label: 'Regulator',
    initial: 'R',
    accent: '#157f3d',
    defaultIdentity: 'PDP authority (simulated)',
    home: '/regulator',
    blurb: 'Supervise agencies and citizen reports',
  },
  verifier: { label: 'Verifier', initial: 'V', accent: '#6b645b', defaultIdentity: 'Anyone, no sign-in', home: '/proof', blurb: 'Check any receipt' },
  operator: { label: 'Operator', initial: 'O', accent: '#a85a00', defaultIdentity: 'Presenter', home: '/operator', blurb: 'Presenter console' },
}

export const ACTORS = Object.keys(ROLE_META) as Actor[]

/** The three doors on /enter. */
export type DoorKey = Extract<Actor, 'citizen' | 'agency' | 'regulator'>

export function toDoor(v: unknown): DoorKey | undefined {
  return v === 'citizen' || v === 'agency' || v === 'regulator' ? v : undefined
}

export function isActor(v: unknown): v is Actor {
  return typeof v === 'string' && v in ROLE_META
}

export function RoleChip({
  actor,
  identity,
  size = 'md',
  className = '',
}: {
  actor: Actor
  /** e.g. "Disdukcapil Kota Contoh (fiktif)". Omit to show the role alone (or the role's default identity). */
  identity?: string | null
  /** md: header / sidebar. sm: compact phone top bar (role name only). */
  size?: 'sm' | 'md'
  className?: string
}) {
  const meta = ROLE_META[actor]
  const who = identity ?? meta.defaultIdentity
  return (
    <span
      className={`en-chip ${size === 'sm' ? 'en-chip-sm' : ''} ${className}`}
      style={{ '--role': meta.accent } as CSSProperties}
      title={who ? `${meta.label} · ${who}` : meta.label}
    >
      <span aria-hidden="true" className="en-chip-disc">
        {meta.initial}
      </span>
      <span className="en-chip-text">
        <span className="en-chip-role">{meta.label}</span>
        {who && size === 'md' ? (
          <>
            <span aria-hidden="true" className="en-chip-sep">
              ·
            </span>
            <span className="en-chip-who">{who}</span>
          </>
        ) : null}
      </span>
    </span>
  )
}
