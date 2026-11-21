'use client'

import { useEffect, useRef } from 'react'

const POOL = '0123456789abcdef'

/**
 * Text that resolves left to right out of hex noise once, on mount (landing "scramble" for values that
 * just arrived). Renders the final text on the server and under reduced motion; screen readers always
 * get the final text.
 */
export function Scramble({ text, run = true, ms = 760, className = '' }: { text: string; run?: boolean; ms?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || !run || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let raf = 0
    const t0 = performance.now()
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / ms)
      const settled = Math.floor(p * text.length)
      let out = text.slice(0, settled)
      for (let i = settled; i < text.length; i++) {
        const c = text[i]
        out += /[0-9a-fA-F]/.test(c) && !(i < 2 && text.startsWith('0x')) ? POOL[(Math.random() * 16) | 0] : c
      }
      el.textContent = out
      if (p < 1) raf = requestAnimationFrame(step)
      else el.textContent = text
    }
    raf = requestAnimationFrame(step)
    return () => {
      cancelAnimationFrame(raf)
      el.textContent = text
    }
  }, [text, run, ms])
  return (
    <span className={className}>
      <span className="sr-only">{text}</span>
      <span ref={ref} aria-hidden="true">
        {text}
      </span>
    </span>
  )
}
