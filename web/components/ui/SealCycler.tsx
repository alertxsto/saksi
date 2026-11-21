'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useReducedMotion } from '@/lib/hooks'
import { IconCheck, IconLock, IconReceipt } from './icons'

const STEPS = [
  { n: '01', k: 'RECORD', text: 'company logs an access', Icon: IconReceipt, pos: 'left-[4%] top-[30%]' },
  { n: '02', k: 'SEAL', text: 'fingerprint locked on chain', Icon: IconLock, pos: 'right-[4%] top-[20%]' },
  { n: '03', k: 'VERIFY', text: 'your phone checks it', Icon: IconCheck, pos: 'left-[4%] bottom-[22%]' },
] as const

/**
 * Client island for the hero seal: cycles 01 RECORD → 02 SEAL → 03 VERIFY every 2.8 s, lighting
 * the matching dot group. Paused off-screen; static on prefers-reduced-motion.
 */
export function SealCycler({ children, legend = true }: { children: ReactNode; legend?: boolean }) {
  const reduced = useReducedMotion()
  const [state, setState] = useState(0)
  const [visible, setVisible] = useState(true)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.1 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (reduced || !visible) return
    const id = setInterval(() => setState((s) => (s + 1) % 3), 2800)
    return () => clearInterval(id)
  }, [reduced, visible])

  const step = STEPS[state]

  return (
    <div ref={ref} className="seal relative" data-state={state}>
      {children}

      {/* step legend, top-left of the board */}
      <ol className="pointer-events-none absolute left-[3.5%] top-[3%] flex flex-col gap-1" aria-hidden="true">
        {STEPS.map((s, i) => (
          <li
            key={s.n}
            className={`label flex items-center gap-1.5 text-[11px] transition-colors duration-500 ${
              i === state ? 'text-ice' : 'text-vault-ink-2/70'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${i === state ? 'bg-ice' : 'bg-dot'}`} />
            {s.n} {s.k}
          </li>
        ))}
      </ol>

      {/* tooltip card snapped to the grid */}
      <div
        key={state}
        className={`anim-rise pointer-events-none absolute ${step.pos} flex w-[46%] max-w-[260px] items-center gap-3 rounded-lg border border-vault-line bg-vault-2/95 p-2.5 pr-3 shadow-[0_10px_30px_-12px_rgba(0,0,0,.6)] max-sm:hidden`}
        aria-hidden="true"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-ice text-vault">
          <step.Icon size={18} strokeWidth={2} />
        </span>
        <span className="min-w-0">
          <span className="label block text-[11px] text-ice">
            {step.n} {step.k}
          </span>
          <span className="block truncate text-[13px] leading-tight text-vault-ink">{step.text}</span>
        </span>
      </div>

      {/* screen-reader version of the cycle */}
      <p className="sr-only">
        How Saksi works: 01 record — a company logs an access. 02 seal — its fingerprint is locked on a public chain. 03
        verify — your phone checks it.
      </p>

      {legend ? (
        <ul className="pointer-events-none absolute bottom-[3.5%] right-[3.5%] flex flex-col gap-1" aria-hidden="true">
          <li className="label flex items-center gap-1.5 text-[11px] text-vault-ink">
            <span className="h-1.5 w-1.5 rounded-full bg-ice" /> SEALED ON CHAIN
          </li>
          <li className="label flex items-center gap-1.5 text-[11px] text-vault-ink-2">
            <span className="h-1.5 w-1.5 rounded-full bg-dot-2" /> DATABASE COPY
          </li>
          <li className="label flex items-center gap-1.5 text-[11px] text-vault-ink-2">
            <span className="h-1.5 w-1.5 rounded-full bg-ok-v" /> VERIFIED BY YOU
          </li>
        </ul>
      ) : null}
    </div>
  )
}
