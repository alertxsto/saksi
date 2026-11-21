'use client'

// A single lattice object on its own canvas. It draws itself in (outline first, then fill) the first
// time it scrolls into view, and morphs from the previous shape whenever `shape` / `param` change.
// Off-screen or hidden tabs pause; prefers-reduced-motion paints the key frame statically.

import { useEffect, useRef } from 'react'
import { PALETTES, type Surface } from './core'
import { createFrame, delayMap, morph, paint } from './morph'
import { createLatticeRenderer } from './renderer'
import { namedShape, type Shape, type ShapeName } from './shapes'

const MORPH_MS = 900
const RADIAL = delayMap({ kind: 'radial' })

export function LatticeObject({
  shape,
  param,
  surface = 'vault',
  className = '',
  title,
}: {
  shape: ShapeName
  /** Shape parameter: `clock` elapsed share (0..1), `block` chain offset in cells, `check` 1 = verified. */
  param?: number
  surface?: Surface
  className?: string
  /** When set the object is announced with this text; otherwise it is decorative. */
  title?: string
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const api = useRef<{ to: (s: Shape) => void } | null>(null)

  useEffect(() => {
    const box = boxRef.current
    const canvas = canvasRef.current
    if (!box || !canvas) return
    const r = createLatticeRenderer(canvas, { surface })
    if (!r) return
    const pal = PALETTES[surface]
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const frame = createFrame()
    let from: Shape = namedShape('empty')
    let to: Shape = from
    let t0 = -1 // pending morph start (-1 = none)
    let visible = false
    let raf = 0
    let introduced = false

    const render = (now: number) => {
      raf = 0
      if (t0 < 0) {
        paint(frame, to, pal)
        r.draw(frame)
        return
      }
      if (!t0) t0 = now
      const p = Math.min(1, (now - t0) / MORPH_MS)
      morph(frame, from, to, p, RADIAL, pal, { outline: true })
      r.draw(frame)
      if (p < 1) raf = requestAnimationFrame(render)
      else {
        from = to
        t0 = -1
      }
    }
    const kick = () => {
      if (!raf && visible && document.visibilityState === 'visible') raf = requestAnimationFrame(render)
    }

    api.current = {
      to(next) {
        if (next === to) return
        from = to // a new morph starts from the last requested shape
        to = next
        if (reduced || !introduced) {
          from = next
          t0 = -1
        } else t0 = 0
        kick()
      },
    }

    const ro = new ResizeObserver(() => {
      r.resize(box.clientWidth)
      if (t0 < 0) {
        paint(frame, to, pal)
        r.draw(frame)
      }
    })
    ro.observe(box)
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting
      if (visible && !introduced) {
        introduced = true
        if (!reduced) {
          from = namedShape('empty')
          t0 = 0
        }
      }
      kick()
    })
    io.observe(box)
    document.addEventListener('visibilitychange', kick)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      io.disconnect()
      document.removeEventListener('visibilitychange', kick)
      api.current = null
    }
  }, [surface])

  useEffect(() => {
    api.current?.to(namedShape(shape, param))
  }, [shape, param])

  return (
    <div ref={boxRef} className={`relative aspect-square w-full ${className}`} role={title ? 'img' : undefined} aria-label={title}>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />
    </div>
  )
}
