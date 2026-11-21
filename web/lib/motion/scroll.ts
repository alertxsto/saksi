// One scroll store for the landing (riset-ui/15 §3): a single rAF per frame runs every scene.
// Scenes read their own rect and write CSS variables or canvas pixels — no React state while scrolling.
// Lenis (components/landing/SmoothScroll) moves the real window scroll, so native scroll events drive this.

import { useEffect, useRef, type RefObject } from 'react'

type Fn = () => void
const subs = new Set<Fn>()
let raf = 0
let bound = false

function run() {
  raf = 0
  subs.forEach((f) => f())
}

/** Ask for one more frame (call from Lenis' scroll event, resize, or after a state change). */
export function tick() {
  if (!raf && typeof window !== 'undefined') raf = requestAnimationFrame(run)
}

function bind() {
  if (bound) return
  bound = true
  window.addEventListener('scroll', tick, { passive: true })
  window.addEventListener('resize', tick)
}

export function subscribe(fn: Fn): () => void {
  bind()
  subs.add(fn)
  tick()
  return () => {
    subs.delete(fn)
  }
}

export const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v)
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
/** 0 → 1 as `v` goes from a to b (clamped). */
export const range = (a: number, b: number, v: number) => clamp((v - a) / (b - a))

/** Element travel through the viewport: 0 when its top meets the bottom edge, 1 when its bottom leaves the top. */
export function progress(el: Element): number {
  const r = el.getBoundingClientRect()
  const vh = window.innerHeight
  return clamp((vh - r.top) / (r.height + vh))
}

/** Pin progress of a tall track with a 100vh sticky child: 0 when the track top hits the viewport top, 1 at release. */
export function pin(el: Element): number {
  const r = el.getBoundingClientRect()
  const span = r.height - window.innerHeight
  return span <= 0 ? 0 : clamp(-r.top / span)
}

/** Same gate as the CSS: pinned scenes only on roomy screens with motion allowed. */
export const PIN_QUERY = '(min-width: 768px) and (min-height: 620px) and (prefers-reduced-motion: no-preference)'
export const REDUCED_QUERY = '(prefers-reduced-motion: reduce)'

export function matches(q: string): boolean {
  return typeof window !== 'undefined' && window.matchMedia(q).matches
}

/**
 * Run `frame(el)` on every scroll frame while mounted. `frame` is kept in a ref, so it may close over
 * fresh values without resubscribing.
 */
export function useScrollScene<T extends Element>(ref: RefObject<T | null>, frame: (el: T) => void) {
  const f = useRef(frame)
  useEffect(() => {
    f.current = frame
  })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    return subscribe(() => f.current(el))
  }, [ref])
}

export { hash01 } from './hash'
