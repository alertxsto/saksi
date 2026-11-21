'use client'

import { useEffect, useRef } from 'react'
import { scramble } from '@/lib/motion/scramble'

const DIGITS = '0123456789'

/**
 * Text that resolves left to right through random glyphs whenever `value` changes (landing hash
 * scramble, 24 Hz). The first paint scrambles too unless `intro` is false. The real value is always in
 * the DOM for SSR, screen readers and reduced motion.
 */
export function Scramble({
  value,
  intro = true,
  digits = false,
  className = '',
}: {
  value: string
  intro?: boolean
  /** Only cycle digits (block numbers); everything else stays put. */
  digits?: boolean
  className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const first = useRef(true)
  useEffect(() => {
    const el = ref.current
    const skip = first.current && !intro
    first.current = false
    if (!el || skip || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    return scramble(el, value, digits ? { alphabet: DIGITS, keep: /[^0-9]/, stepMs: 40 } : { stepMs: 22 })
  }, [value, intro, digits])
  // keyed by value: scramble writes textContent, so React gets a fresh node for every new value
  return (
    <span key={value} ref={ref} className={className}>
      {value}
    </span>
  )
}
