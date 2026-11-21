import type { CSSProperties } from 'react'

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]

/**
 * Odometer number: each digit is a 0–9 column that rolls to its value (CSS transition, keyed from the
 * right so existing places keep rolling when the number grows a digit). Separators stay still.
 * Reduced motion: the global rule cuts the transition to 1 ms, so the value just appears.
 */
export function RollNumber({ value, className = '', dot = true }: { value: string; className?: string; dot?: boolean }) {
  const chars = [...value]
  return (
    <span className={`stg-roll ${dot ? 'doto' : 'font-mono tnum'} ${className}`}>
      <span className="sr-only">{value}</span>
      <span aria-hidden="true" className="stg-roll-row">
        {chars.map((c, i) => {
          const key = chars.length - i
          if (!/\d/.test(c)) {
            return (
              <span key={`s${key}`} className={dot ? 'stg-roll-sep' : ''}>
                {c}
              </span>
            )
          }
          return (
            <span key={`d${key}`} className="stg-roll-cell" style={{ '--n': Number(c), '--k': key } as CSSProperties}>
              <span className="invisible">{c}</span>
              <span className="stg-roll-col">
                {DIGITS.map((d) => (
                  <span key={d}>{d}</span>
                ))}
              </span>
            </span>
          )
        })}
      </span>
    </span>
  )
}
