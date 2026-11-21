'use client'

import { useEffect, useRef, type ReactNode, type Ref } from 'react'

/** Saksi line-art tokens (light/paper). */
export const K = {
  card: '#FBFAF7',
  p2: '#EBE8E0',
  line: '#D9D4C9',
  l2: '#BFB8AA',
  l3: '#9A9288',
  ink: '#1E1A16',
  blue: '#2A2AE8',
  ice: '#9BD9E0',
  ok: '#5BCB8A',
  pend: '#F2A33A',
  ai: '#BDB4F8',
  bad: '#FF5A4D',
}

export type SetFn = (name: string, attrs: Record<string, string | number>) => void
/** Pure function of loop time t (s) and loop index k: writes attributes, never React state. */
export type Tick = (t: number, a: SetFn, k: number) => void

export const clamp = (x: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x))
export const ss = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}
export const eio = (t: number) => {
  t = clamp(t)
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
}
export const eout = (t: number) => 1 - (1 - clamp(t)) ** 3
/** Damped spring step response 0→1 (k110 c10 m1: ~18% overshoot, the base needle feel). */
export const spr = (tau: number, z = 5, w = 9.22) =>
  tau <= 0 ? 0 : 1 - Math.exp(-z * tau) * (Math.cos(w * tau) + (z / w) * Math.sin(w * tau))
/** Snappy pop for scale-ins (~25% overshoot). */
export const pop = (tau: number) => spr(tau, 7, 15.8)
export const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

/** One rAF loop per illustration; paused offscreen / hidden tab; reduced motion renders `still`. */
export function useLoop(period: number, tick: Tick, still: number, stillK = 0) {
  const ref = useRef<SVGSVGElement>(null)
  useEffect(() => {
    const svg = ref.current
    if (!svg) return
    const map = new Map<string, SVGElement>()
    svg.querySelectorAll<SVGElement>('[data-a]').forEach((el) => map.set(el.dataset.a as string, el))
    const a: SetFn = (n, attrs) => {
      const el = map.get(n)
      if (!el) return
      for (const key in attrs) {
        const v = String(attrs[key])
        if (key === 'text') {
          if (el.textContent !== v) el.textContent = v
        } else el.setAttribute(key, v)
      }
    }
    const mq = matchMedia('(prefers-reduced-motion: reduce)')
    let raf = 0
    let last = 0
    let clock = 0
    let seen = false
    const frame = (now: number) => {
      clock += last ? Math.min(0.05, (now - last) / 1000) : 0
      last = now
      tick(clock % period, a, Math.floor(clock / period))
      raf = requestAnimationFrame(frame)
    }
    const sync = () => {
      cancelAnimationFrame(raf)
      raf = 0
      last = 0
      if (mq.matches) tick(still, a, stillK)
      else if (seen && !document.hidden) raf = requestAnimationFrame(frame)
    }
    const io = new IntersectionObserver(
      ([e]) => {
        seen = e.isIntersecting
        sync()
      },
      { rootMargin: '100px' },
    )
    tick(mq.matches ? still : 0, a, mq.matches ? stillK : 0)
    io.observe(svg)
    document.addEventListener('visibilitychange', sync)
    mq.addEventListener('change', sync)
    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
      document.removeEventListener('visibilitychange', sync)
      mq.removeEventListener('change', sync)
    }
  }, [period, tick, still, stillK])
  return ref
}

const CSS =
  '.ilx :is(path,rect,circle,line,ellipse){vector-effect:non-scaling-stroke}' +
  '.ilx text{font-family:var(--font-mono),ui-monospace,monospace;font-size:11px;letter-spacing:.04em;font-variant-numeric:tabular-nums}'

export type IllusProps = { className?: string; framed?: boolean }

export function Illus({
  label,
  framed = true,
  className,
  svgRef,
  children,
}: IllusProps & { label: string; svgRef: Ref<SVGSVGElement>; children: ReactNode }) {
  return (
    <svg
      ref={svgRef}
      viewBox="0 0 640 400"
      className={`ilx ${className ?? ''}`}
      role="img"
      aria-label={label}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      style={{ display: 'block', width: '100%', height: 'auto' }}
    >
      <style>{CSS}</style>
      {framed && <rect x={0.75} y={0.75} width={638.5} height={398.5} rx={16} fill={K.card} stroke={K.line} />}
      {children}
    </svg>
  )
}

/** Scaffolding rail: hairline with bars (null) and tiny 5px colour squares, as in the Pencil set. */
export function Rail({ y, x1, x2, m }: { y: number; x1: number; x2: number; m: [number, string | null][] }) {
  return (
    <g>
      <line x1={x1} x2={x2} y1={y} y2={y} stroke={K.line} strokeWidth={1} />
      {m.map(([x, c]) =>
        c ? <rect key={x} x={x - 2.5} y={y - 2.5} width={5} height={5} fill={c} /> : <rect key={x} x={x - 11} y={y - 2.5} width={22} height={5} fill={K.line} />,
      )}
    </g>
  )
}

/** Figma-style 5px corner handles centred on a box's corners (ink, matching the Pencil export). */
export function Handles({ x, y, w, h, c = K.ink }: { x: number; y: number; w: number; h: number; c?: string }) {
  return (
    <g fill={c}>
      {[
        [x, y],
        [x + w, y],
        [x, y + h],
        [x + w, y + h],
      ].map(([cx, cy]) => (
        <rect key={`${cx}-${cy}`} x={cx - 2.5} y={cy - 2.5} width={5} height={5} />
      ))}
    </g>
  )
}
