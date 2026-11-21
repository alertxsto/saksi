// Canvas2D lattice renderer: one arc per cell, DPR capped at 2. Only the object's dots are drawn; the
// empty background matrix is off unless `matrix` is set. Dot diameter at step 3 ≈ .64 × pitch.

import { N, PALETTES, type Surface } from './core'
import type { Frame } from './morph'

const R_PER_STEP = 0.107 // radius per size step, × pitch
const R_EMPTY = 0.075
const MIN_S = 0.7

export type LatticeRenderer = {
  resize: (cssSize: number) => void
  draw: (f: Frame) => void
}

export function createLatticeRenderer(canvas: HTMLCanvasElement, { surface = 'vault', backdrop = false, matrix = false }: { surface?: Surface; backdrop?: boolean; matrix?: boolean } = {}): LatticeRenderer | null {
  const ctx = canvas.getContext('2d', { alpha: true })
  if (!ctx) return null
  const empty = PALETTES[surface][0]
  const bg = surface === 'vault' ? '36,33,29' : '244,242,236'
  let size = 0
  let dpr = 1

  return {
    resize(css) {
      dpr = Math.min(2, window.devicePixelRatio || 1)
      size = css
      const px = Math.max(1, Math.round(css * dpr))
      if (canvas.width !== px) {
        canvas.width = px
        canvas.height = px
      }
    },
    draw(f) {
      if (!size) return
      const p = size / N
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, size, size)
      if (backdrop) {
        // soft surface-coloured disc so text placed behind the stage is occluded by the object
        const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.18, size / 2, size / 2, size * 0.54)
        g.addColorStop(0, `rgba(${bg},1)`)
        g.addColorStop(1, `rgba(${bg},0)`)
        ctx.fillStyle = g
        ctx.fillRect(0, 0, size, size)
      }
      // pass 1 (opt-in): empty cells in one path
      const r0 = matrix ? p * R_EMPTY : 0
      if (matrix) {
      ctx.beginPath()
      for (let j = 0; j < N; j++)
        for (let i = 0; i < N; i++) {
          if (f.s[j * N + i] > 0.05) continue
          const x = (i + 0.5) * p
          const y = (j + 0.5) * p
          ctx.moveTo(x + r0, y)
          ctx.arc(x, y, r0, 0, Math.PI * 2)
        }
      ctx.fillStyle = `rgb(${empty[0]},${empty[1]},${empty[2]})`
      ctx.fill()
      }
      // pass 2: shape dots
      for (let j = 0; j < N; j++)
        for (let i = 0; i < N; i++) {
          const k = j * N + i
          const s = f.s[k]
          // crisp object dots only: sub-step dots (mid-morph ghosts) are skipped, never faded
          if (s < MIN_S) continue
          const r = Math.max(r0, p * R_PER_STEP * s)
          ctx.fillStyle = `rgb(${Math.round(f.rgb[k * 3])},${Math.round(f.rgb[k * 3 + 1])},${Math.round(f.rgb[k * 3 + 2])})`
          ctx.beginPath()
          ctx.arc((i + 0.5) * p, (j + 0.5) * p, r, 0, Math.PI * 2)
          ctx.fill()
        }
    },
  }
}
