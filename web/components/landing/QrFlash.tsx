'use client'

import { useRef, type ReactNode } from 'react'
import { range, useScrollScene } from '@/lib/motion/scroll'

/** Rises in with the closer and flashes its registration marks ice once at ~80% of its entry (15 S9). */
export function QrFlash({ className = '', children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useScrollScene(ref, (el) => {
    const r = el.getBoundingClientRect()
    const q = range(window.innerHeight, window.innerHeight * 0.45, r.top)
    el.style.setProperty('--q', q.toFixed(3))
    if (q > 0.8) el.setAttribute('data-flash', '')
    else if (q < 0.2) el.removeAttribute('data-flash')
  })
  return (
    <div ref={ref} className={`qr-flash ${className}`}>
      {children}
    </div>
  )
}
