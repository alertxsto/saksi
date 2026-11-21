'use client'

import type { CSSProperties } from 'react'
import { useT } from '@/lib/client/lang'
import { hash01 } from '@/lib/motion/hash'

const POOL = '0123456789ABCDEF'

/**
 * Odometer letter roll (contentarchitecture A.6): each letter is a 1-line window over a column of six
 * glyphs [c, r, r, r, r, c]. Hovering the parent link/button rolls the column up 5 cells, 520 ms,
 * cubic-bezier(.23,1,.32,1), 28 ms per letter. Glyphs are seeded, so SSR and client markup match.
 * CSS lives in globals.css (.odo-*); reduced motion keeps the label still.
 */
export function OdoText({ children }: { children: string }) {
  // drawn letter by letter, so the EN / ID DOM pass cannot reach it: translate the whole label here
  const label = useT()(children)
  const seed = label.length * 31
  return (
    <span className="odo">
      <span className="sr-only">{label}</span>
      <span aria-hidden="true" className="odo-row">
        {[...label].map((c, i) =>
          c === ' ' ? (
            <span key={i}>&nbsp;</span>
          ) : (
            <span key={i} className="odo-cell" style={{ '--i': i } as CSSProperties}>
              <span className="invisible">{c}</span>
              <span className="odo-col">
                <span>{c}</span>
                {[0, 1, 2, 3].map((k) => (
                  <span key={k}>{POOL[Math.floor(hash01(seed + i, k + 1) * POOL.length)]}</span>
                ))}
                <span>{c}</span>
              </span>
            </span>
          ),
        )}
      </span>
    </span>
  )
}
