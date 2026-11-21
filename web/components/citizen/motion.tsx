'use client'

import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react'
import { Heading } from '@/components/landing/Words'
import { DotoValue } from '@/components/ui/DotoValue'
import { useHydrated } from '@/lib/hooks'

const REDUCED = '(prefers-reduced-motion: reduce)'
const POOL = '0123456789ABCDEF'
const reduced = () => typeof window !== 'undefined' && window.matchMedia(REDUCED).matches

/**
 * Reveal root for the citizen app (same contract as components/landing/RevealRoot, which only scans once
 * on mount): watches its subtree, so [data-words] headlines and [data-stagger] lists that appear after
 * data loads still rise once when they scroll in. CSS in globals.css owns the motion.
 */
export function CitizenReveal({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const root = ref.current
    if (!root) return
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting || e.boundingClientRect.bottom < 0) {
            e.target.setAttribute('data-shown', '')
            io.unobserve(e.target)
          }
        }
      },
      { rootMargin: '0px 0px -40px 0px' },
    )
    const scan = () =>
      root.querySelectorAll<HTMLElement>('[data-words]:not([data-shown]),[data-stagger]:not([data-shown])').forEach((n) => io.observe(n))
    scan()
    const mo = new MutationObserver(scan)
    mo.observe(root, { childList: true, subtree: true })
    return () => {
      mo.disconnect()
      io.disconnect()
    }
  }, [])
  return (
    <div ref={ref} className="flex flex-1 flex-col">
      {children}
    </div>
  )
}

/** true only for components mounted on the client after hydration (live arrivals, verdicts). */
function useFreshMount(): boolean {
  const hydrated = useHydrated()
  const [fresh] = useState(hydrated)
  return fresh
}

/**
 * Letter scramble for values that change (counts, labels): when `value` changes — or on a fresh client
 * mount with `onMount` — letters cycle through hex glyphs and lock left to right. Screen readers get the
 * final value only. Reduced motion: the value simply swaps.
 */
export function Scramble({
  value,
  onMount = false,
  duration = 460,
  className = '',
}: {
  value: string
  onMount?: boolean
  duration?: number
  className?: string
}) {
  const fresh = useFreshMount()
  const [frame, setFrame] = useState<string | null>(null)
  const prev = useRef<string | null>(onMount && fresh ? null : value)

  useEffect(() => {
    if (prev.current === value) return
    prev.current = value
    if (reduced()) return
    let raf = 0
    const t0 = performance.now()
    const tick = (t: number) => {
      const p = (t - t0) / duration
      if (p >= 1) {
        setFrame(null)
        return
      }
      const locked = Math.floor(p * value.length)
      setFrame(
        [...value]
          .map((c, i) => (i < locked || c === ' ' || c === '·' ? c : POOL[Math.floor(Math.random() * POOL.length)]))
          .join(''),
      )
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])

  return (
    <span className={className}>
      <span className="sr-only">{value}</span>
      <span aria-hidden="true">{frame ?? value}</span>
    </span>
  )
}

/**
 * Seconds in Doto ("1.8 s") that count up from 0 when the verdict first appears on the client.
 * SSR, hydration and reduced motion show the measured value straight away.
 */
export function CountSecs({ ms, className = '' }: { ms: number; className?: string }) {
  const fresh = useFreshMount()
  const [shown, setShown] = useState<number | null>(null)
  const started = useRef(false)

  useEffect(() => {
    if (!fresh || started.current || reduced()) return
    started.current = true
    let raf = 0
    const t0 = performance.now()
    const D = 620
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / D)
      const e = 1 - Math.pow(1 - p, 3)
      setShown(p >= 1 ? null : ms * e)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [fresh, ms])

  const v = shown ?? ms
  return (
    <span className={className}>
      <span className="sr-only">{(ms / 1000).toFixed(1)} seconds</span>
      <span aria-hidden="true">
        <DotoValue value={(v / 1000).toFixed(1)} unit="s" />
      </span>
    </span>
  )
}

/**
 * Word-rise headline (landing `Heading`) that reveals itself on mount, so it also works outside a
 * reveal root (e.g. /proof reuses VerifyResult). Two frames let the hidden state paint first.
 */
export function RiseHeading(props: ComponentProps<typeof Heading>) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current?.querySelector('[data-words]')
    if (!el) return
    let b = 0
    const a = requestAnimationFrame(() => {
      b = requestAnimationFrame(() => el.setAttribute('data-shown', ''))
    })
    return () => {
      cancelAnimationFrame(a)
      cancelAnimationFrame(b)
    }
  }, [])
  return (
    <div ref={ref} className="contents">
      <Heading {...props} />
    </div>
  )
}
