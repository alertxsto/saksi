import type { ElementType } from 'react'
import { WordSplit } from './WordSplit'

/** Split a string into word spans carrying a running index (--i). Spaces stay real text nodes. EN / ID aware. */
export function words(text: string, from = 0, className = 'w') {
  return <WordSplit text={text} from={from} className={className} />
}

/**
 * Two-tone headline (zaro A.3: weight 500, −0.02em, muted tail) with zaro's word rise:
 * y 18 → 0, blur 8 → 0, 48 ms stagger after 60 ms, triggered once by RevealRoot (`data-words`).
 * Without JS or with reduced motion the words are simply there.
 */
export function Heading({
  as: Tag = 'h2',
  lead,
  tail,
  className = '',
  tailClass = 'text-ink-2',
  id,
}: {
  as?: ElementType
  lead: string
  tail?: string
  className?: string
  tailClass?: string
  id?: string
}) {
  const n = lead.split(' ').length
  return (
    <Tag id={id} data-words="" className={`text-balance font-medium tracking-[-0.02em] ${className}`}>
      {words(lead)}
      {tail ? (
        <>
          {' '}
          <span className={tailClass}>{words(tail, n)}</span>
        </>
      ) : null}
    </Tag>
  )
}

/** Editorial frame (zaro "framed" 1240) with full-height hairlines on both edges. */
export function FrameRules({ vault = false, center = false }: { vault?: boolean; center?: boolean }) {
  const c = vault ? 'border-vault-line' : 'border-line'
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      <div className={`frame absolute inset-y-0 left-1/2 -translate-x-1/2 border-x ${c}`} />
      {center ? <div className={`absolute inset-y-0 left-1/2 hidden border-l md:block ${c}`} /> : null}
    </div>
  )
}
