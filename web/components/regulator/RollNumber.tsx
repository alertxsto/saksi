'use client'

import { useLayoutEffect, useRef, type CSSProperties } from 'react'

const ROW = 1.2 // em; room above and below each Doto glyph so no neighbouring digit shows

/**
 * Doto counter that rolls like the landing breach clock: one 0–9 column per digit. With `intro` the
 * columns roll up from 0 on first paint; whenever `value` changes they roll to the new digits (CSS transition, 70 ms
 * per column). Reduced motion: the global rule in globals.css makes the roll instant.
 * `value === null` shows two quiet dashes (no data yet).
 */
export function RollNumber({
  value,
  pad = 2,
  intro = true,
  className = '',
}: {
  value: number | null
  pad?: number
  /** Roll up from 0 on first paint. Off on calm screens: there the number only rolls when it changes. */
  intro?: boolean
  className?: string
}) {
  const rootRef = useRef<HTMLSpanElement>(null)
  const text = value === null ? null : String(Math.max(0, Math.round(value))).padStart(pad, '0')

  // Intro: jump every column to 0 without a transition, then let React's inline transform roll it.
  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root || !intro || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const cols = Array.from(root.querySelectorAll<HTMLElement>('.rg-odo-col'))
    const finals = cols.map((c) => c.style.transform)
    cols.forEach((c) => {
      c.style.transition = 'none'
      c.style.transform = 'translateY(0)'
    })
    void root.offsetHeight
    const raf = requestAnimationFrame(() =>
      cols.forEach((c, i) => {
        c.style.transition = ''
        c.style.transform = finals[i]
      }),
    )
    return () => cancelAnimationFrame(raf)
    // Only when the number of columns changes (first data, or 9 → 10).
  }, [text?.length, intro])

  if (text === null) {
    return (
      // no data yet: three Doto-sized dots on the baseline, never a number that could read as zero
      <span className={`inline-flex h-[1.2em] items-end gap-[0.14em] pb-[0.14em] leading-none text-ink-3 ${className}`} role="img" aria-label="No data">
        {[0, 1, 2].map((k) => (
          <span key={k} className="size-[0.1em] rounded-full bg-current" />
        ))}
      </span>
    )
  }

  return (
    <span ref={rootRef} className={`rg-odo doto ${className}`} role="img" aria-label={String(value)}>
      {[...text].map((d, i) => (
        <span key={i} className="rg-odo-cell" aria-hidden="true">
          <span
            className="rg-odo-col"
            style={{ transform: `translateY(${-Number(d) * ROW}em)`, '--i': text.length - 1 - i } as CSSProperties}
          >
            {Array.from({ length: 10 }, (_, k) => (
              <span key={k}>{k}</span>
            ))}
          </span>
        </span>
      ))}
    </span>
  )
}
