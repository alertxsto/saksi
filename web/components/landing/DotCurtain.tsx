'use client'

import { useEffect, useRef } from 'react'
import { clamp, hash01, matches, REDUCED_QUERY, subscribe } from '@/lib/motion/scroll'

const HEX = { paper: '#F4F2EC', vault: '#24211D' } as const
type Surface = keyof typeof HEX
const CELL = 12

/**
 * Dot-curtain seam (15 §3 #4, contentarchitecture seams): a strip of 12 px lattice cells where every
 * cell of the lower surface grows from a dot into a full square as the strip crosses the viewport —
 * bottom rows first, grain from a fixed hash — so one surface dissolves into the next in the page's own
 * dot grammar. Reverse scroll un-dissolves. No JS: a hard 50/50 split; reduced motion: a static dither.
 */
export function DotCurtain({ from, to, className = '' }: { from: Surface; to: Surface; className?: string }) {
  const boxRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const box = boxRef.current
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!box || !canvas || !ctx) return
    const reduced = matches(REDUCED_QUERY)
    let w = 0
    let h = 0
    let last = -1

    const draw = (p: number) => {
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      const dpr = canvas.width / Math.max(1, w)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.fillStyle = HEX[from]
      ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = HEX[to]
      const cols = Math.ceil(w / CELL)
      const rows = Math.ceil(h / CELL)
      for (let j = 0; j < rows; j++) {
        const down = (j + 0.5) / rows // 0 top … 1 bottom
        for (let i = 0; i < cols; i++) {
          const at = 0.08 + 0.58 * (1 - down) + 0.26 * hash01(i, j)
          const c = clamp((p - at) / 0.14)
          if (c <= 0) continue
          const x = i * CELL
          const y = j * CELL
          if (c >= 1) {
            ctx.fillRect(x, y, CELL + 0.5, CELL + 0.5)
            continue
          }
          const s = 2 + (CELL - 2) * c
          const r = (s / 2) * (1 - c)
          ctx.beginPath()
          ctx.roundRect(x + (CELL - s) / 2, y + (CELL - s) / 2, s, s, r)
          ctx.fill()
        }
      }
    }

    const resize = () => {
      w = box.clientWidth
      h = box.clientHeight
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      last = -1
      if (reduced) draw(0.55)
    }
    const ro = new ResizeObserver(resize)
    ro.observe(box)
    resize()
    if (reduced) return () => ro.disconnect()

    const unsub = subscribe(() => {
      const r = box.getBoundingClientRect()
      const vh = window.innerHeight
      if (r.bottom < -40 || r.top > vh + 40) return
      const p = clamp((vh * 0.95 - r.top) / (vh * 0.75))
      if (Math.abs(p - last) < 0.002) return
      last = p
      draw(p)
    })
    return () => {
      ro.disconnect()
      unsub()
    }
  }, [from, to])

  return (
    <div
      ref={boxRef}
      aria-hidden="true"
      className={`relative h-[120px] md:h-[168px] ${className}`}
      style={{ background: `linear-gradient(${HEX[from]} 50%, ${HEX[to]} 50%)` }}
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
    </div>
  )
}
