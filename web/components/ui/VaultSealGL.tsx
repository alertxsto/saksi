'use client'

// Vault Seal, live: a procedural 3D padlock (check-mark keyhole, torn receipt edge) raymarched in
// WebGL2 and halftoned into a dot matrix. Cursor trail swells dots and tints them ice, the lock
// idles ±12° and follows scroll ±35°, and `verdict` sweeps the ice dots green/red from the centre.
// Falls back to the static <VaultSeal/> SVG without WebGL2 or with prefers-reduced-motion.
// Dynamic-import friendly: `dynamic(() => import('@/components/ui/VaultSealGL'))`.

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useReducedMotion } from '@/lib/hooks'
import { createSealRenderer, type SealRenderer, type Verdict } from '@/lib/seal/renderer'
import { IconCheck, IconLock, IconReceipt } from './icons'
import { VaultSeal } from './VaultSeal'

export type { Verdict as SealVerdict }

const Q = 100 / 14 // one grid cell, % of the board
const STEPS = [
  { n: '01', k: 'RECORD', text: 'company logs an access', Icon: IconReceipt, col: 1, row: 10 },
  { n: '02', k: 'SEAL', text: 'fingerprint locked on chain', Icon: IconLock, col: 9, row: 2 },
  { n: '03', k: 'VERIFY', text: 'your phone checks it', Icon: IconCheck, col: 1, row: 5 },
] as const
const LEGEND = [
  ['SEALED ON CHAIN', 'bg-ice'],
  ['DATABASE COPY', 'bg-dot-2'],
  ['VERIFIED BY YOU', 'bg-vault-ink'],
] as const
const TONE = { idle: 'idle', match: 'ok', altered: 'bad' } as const
const MARKS: Array<[number, number]> = [
  [1, 1],
  [13, 1],
  [1, 13],
  [13, 13],
  [7, 0],
  [0, 7],
  [14, 7],
  [7, 14],
]

let gl2: boolean | null = null
function hasWebGL2() {
  if (gl2 === null) {
    try {
      const ctx = document.createElement('canvas').getContext('webgl2')
      gl2 = !!ctx
      ctx?.getExtension('WEBGL_lose_context')?.loseContext()
    } catch {
      gl2 = false
    }
  }
  return gl2
}
const noopSubscribe = () => () => {}

function Grid() {
  const q = 720 / 14
  return (
    <svg viewBox="0 0 720 720" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
      <g stroke="var(--color-vault-line)" strokeWidth={1} vectorEffect="non-scaling-stroke">
        {Array.from({ length: 13 }, (_, i) => (i + 1) * q).map((v) => (
          <g key={v}>
            <line x1={v} y1={0} x2={v} y2={720} vectorEffect="non-scaling-stroke" />
            <line x1={0} y1={v} x2={720} y2={v} vectorEffect="non-scaling-stroke" />
          </g>
        ))}
      </g>
      <g fill="#4e4840">
        {MARKS.map(([c, r]) => (
          <rect key={`${c}-${r}`} x={c * q - 4} y={r * q - 4} width={8} height={8} />
        ))}
      </g>
    </svg>
  )
}

export function VaultSealGL({
  verdict = 'idle',
  overlay = true,
  grid = false,
  interactive = true,
  receipt = true,
  pitch,
  className = '',
  title,
}: {
  verdict?: Verdict
  /** Step cards + legend (auto-hidden when the board is narrower than 440px). */
  overlay?: boolean
  /** 14×14 board hairlines + registration squares behind the dots. Off by default: padlock dots only. */
  grid?: boolean
  /** Cursor trail + tilt. */
  interactive?: boolean
  /** Torn receipt edge + perforation on the body. */
  receipt?: boolean
  /** Dot pitch in CSS px (default: board / 88, clamped 3.5–8.5). */
  pitch?: number
  className?: string
  /** When set, the seal is announced with this text; otherwise it is decorative. */
  title?: string
}) {
  const reduced = useReducedMotion()
  const supported = useSyncExternalStore(noopSubscribe, hasWebGL2, () => true)
  const [lost, setLost] = useState(false)
  const live = supported && !reduced && !lost
  const [step, setStep] = useState(0)
  const [visible, setVisible] = useState(false)

  const boardRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<SealRenderer | null>(null)
  const verdictRef = useRef(verdict)
  const stepRef = useRef(step)

  // visibility (IntersectionObserver + tab) drives the cycler and the render loop
  useEffect(() => {
    const el = boardRef.current
    if (!el) return
    let inView = false
    const sync = () => {
      const on = inView && document.visibilityState === 'visible'
      setVisible(on)
      rendererRef.current?.setActive(on)
    }
    const io = new IntersectionObserver(([e]) => {
      inView = e.isIntersecting
      sync()
    })
    io.observe(el)
    document.addEventListener('visibilitychange', sync)
    return () => {
      io.disconnect()
      document.removeEventListener('visibilitychange', sync)
    }
  }, [live])

  // renderer lifecycle + size + scroll + pointer
  useEffect(() => {
    const board = boardRef.current
    const canvas = canvasRef.current
    if (!live || !board || !canvas) return
    const r = createSealRenderer(canvas, { receipt, pitch, verdict: verdictRef.current, onLost: () => setLost(true) })
    if (!r) {
      queueMicrotask(() => setLost(true))
      return
    }
    rendererRef.current = r
    r.setFocus(stepRef.current)

    const resize = () => r.resize(board.clientWidth, Math.min(2, window.devicePixelRatio || 1))
    const ro = new ResizeObserver(resize)
    ro.observe(board)
    resize()

    const onScroll = () => {
      const b = board.getBoundingClientRect()
      const vh = window.innerHeight
      r.setScroll((vh - b.top) / (vh + b.height))
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })

    const move = (e: PointerEvent) => {
      const b = board.getBoundingClientRect()
      r.pointer((e.clientX - b.left) / b.width, (e.clientY - b.top) / b.height)
    }
    const leave = () => r.pointer(null)
    if (interactive) {
      board.addEventListener('pointermove', move)
      board.addEventListener('pointerleave', leave)
    }

    const b = board.getBoundingClientRect()
    r.setActive(b.bottom > 0 && b.top < window.innerHeight && document.visibilityState === 'visible')

    return () => {
      ro.disconnect()
      window.removeEventListener('scroll', onScroll)
      board.removeEventListener('pointermove', move)
      board.removeEventListener('pointerleave', leave)
      r.destroy()
      rendererRef.current = null
    }
  }, [live, receipt, pitch, interactive])

  useEffect(() => {
    verdictRef.current = verdict
    rendererRef.current?.setVerdict(verdict)
  }, [verdict])

  useEffect(() => {
    stepRef.current = step
    rendererRef.current?.setFocus(overlay ? step : -1)
  }, [step, overlay])

  useEffect(() => {
    if (reduced || !visible || !overlay) return
    const id = setInterval(() => setStep((s) => (s + 1) % 3), 2800)
    return () => clearInterval(id)
  }, [reduced, visible, overlay])

  return (
    <div
      ref={boardRef}
      className={`seal @container relative aspect-square w-full touch-pan-y overflow-hidden rounded-xl border border-vault-line bg-vault grain ${className}`}
      data-state={step}
      role={title ? 'img' : undefined}
      aria-label={title}
    >
      {live ? (
        <>
          {grid ? <Grid /> : null}
          <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />
        </>
      ) : (
        <div className="absolute inset-0">
          <VaultSeal tone={TONE[verdict]} grid={grid} />
        </div>
      )}

      {overlay ? (
        <div className="pointer-events-none absolute inset-0 @max-[440px]:hidden" aria-hidden="true">
          <ol className="absolute flex flex-col gap-1" style={{ left: `${Q}%`, top: `${Q * 0.55}%` }}>
            {STEPS.map((s, i) => (
              <li
                key={s.n}
                className={`label flex items-center gap-1.5 transition-colors duration-500 ${i === step ? 'text-ice' : 'text-vault-ink-2/70'}`}
              >
                <span className={`h-[7px] w-[7px] rounded-[2px] ${i === step ? 'bg-ice' : 'bg-dot'}`} />
                {s.n} {s.k}
              </li>
            ))}
          </ol>

          {STEPS.map((s, i) => (
            <div
              key={s.n}
              className={`absolute flex items-center gap-2.5 rounded-md border border-vault-line bg-vault-2/95 p-2 pr-3 shadow-[0_10px_30px_-12px_rgba(0,0,0,.6)] transition-[opacity,transform] duration-500 ${
                i === step ? 'translate-y-0 opacity-100' : 'translate-y-1.5 opacity-0'
              }`}
              style={{ left: `${s.col * Q}%`, top: `${s.row * Q}%`, minWidth: `${4 * Q}%`, minHeight: `${Q}%` }}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-ice text-vault">
                <s.Icon size={18} strokeWidth={2} />
              </span>
              <span className="min-w-0">
                <span className="label block text-ice">
                  {s.n} {s.k}
                </span>
                <span className="block whitespace-nowrap text-[13px] leading-tight text-vault-ink">{s.text}</span>
              </span>
            </div>
          ))}

          <ul className="absolute flex flex-col gap-1" style={{ right: `${Q}%`, bottom: `${Q * 0.6}%` }}>
            {LEGEND.map(([label, dot]) => (
              <li key={label} className="label flex items-center gap-1.5 text-vault-ink-2">
                <span className={`h-[7px] w-[7px] rounded-full ${dot}`} />
                {label}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="sr-only">
        How Saksi works: 01 record — a company logs an access. 02 seal — its fingerprint is locked on a public chain. 03
        verify — your phone checks it.
      </p>
    </div>
  )
}

export default VaultSealGL
