// Per-cell morph between two shapes on the shared lattice (riset-ui/15 §3 #1, 18 §C.5):
//   delay = spread·dist/maxDist + .04·hash,  t = clamp((p − delay)/span),  size = mix(A, B, easeOutCubic(t))
// plus the ghost "drawn, then rendered" pass: B's edge cells appear first as outline dots, then fill.

import { C, CELLS, clamp01, easeOutCubic, hash, MID, N, type Palette } from './core'
import type { Shape } from './shapes'

export type Frame = { s: Float32Array; rgb: Float32Array }

export function createFrame(): Frame {
  return { s: new Float32Array(CELLS), rgb: new Float32Array(CELLS * 3) }
}

/** Copy a shape into a frame. `sizeMul` scales every dot. */
export function paint(out: Frame, A: Shape, pal: Palette) {
  for (let k = 0; k < CELLS; k++) {
    out.s[k] = A.s[k]
    const a = pal[A.c[k]]
    out.rgb[k * 3] = a[0]
    out.rgb[k * 3 + 1] = a[1]
    out.rgb[k * 3 + 2] = a[2]
  }
}

// ---- delay maps (0..1 per cell, cached) ---------------------------------------------------------
export type DelayMode =
  | { kind: 'radial'; x?: number; y?: number }
  | { kind: 'angular' }
  | { kind: 'row'; y: number }
  | { kind: 'rows'; rows: readonly number[]; x0: number; x1: number }

const delays = new Map<string, Float32Array>()
export function delayMap(mode: DelayMode): Float32Array {
  const key = JSON.stringify(mode)
  let d = delays.get(key)
  if (d) return d
  d = new Float32Array(CELLS)
  let max = 0
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const x = i + 0.5
      const y = j + 0.5
      let v = 0
      if (mode.kind === 'radial') v = Math.hypot(x - (mode.x ?? MID), y - (mode.y ?? MID))
      else if (mode.kind === 'angular') {
        let a = Math.atan2(y - MID, x - MID) + Math.PI / 2
        if (a < 0) a += Math.PI * 2
        v = (a / (Math.PI * 2)) * 0.75 + (Math.hypot(x - MID, y - MID) / (MID * 1.42)) * 0.25
      } else if (mode.kind === 'row') v = Math.abs(y - (mode.y + 0.5)) + Math.abs(x - MID) * 0.25
      else {
        const r = mode.rows.indexOf(j)
        v = r < 0 ? 0 : (r + clamp01((x - mode.x0) / (mode.x1 - mode.x0))) / mode.rows.length
      }
      d[j * N + i] = v
      if (v > max) max = v
    }
  }
  const mono = mode.kind === 'angular' || mode.kind === 'rows'
  for (let k = 0; k < CELLS; k++) d[k] = (mono ? d[k] : d[k] / (max || 1)) * 0.96 + (mode.kind === 'rows' ? 0 : 0.04 * hash(k, 1, 9))
  delays.set(key, d)
  return d
}

export type MorphOpts = {
  /** Share of `p` taken by the delay wave (default .65). */
  spread?: number
  /** Per-cell transition length in `p` (default .35). */
  span?: number
  /** Ghost blueprint pass: B's outline appears first, then the interior fills. */
  outline?: boolean
}

const OUTLINE_S = 1.7

/** Write morph(A → B, p) into `out`. */
export function morph(out: Frame, A: Shape, B: Shape, p: number, delay: Float32Array, pal: Palette, opts: MorphOpts = {}) {
  const { spread = 0.65, span = 0.35, outline = false } = opts
  const lineC = pal[C.ICE]
  for (let k = 0; k < CELLS; k++) {
    const d = delay[k]
    const a = pal[A.c[k]]
    const b = pal[B.c[k]]
    const as = A.s[k]
    let s: number
    let r: number
    let g: number
    let bl: number
    if (outline) {
      // line: B's outline is drawn first (blueprint); A fades to a ghost behind it; then B fills
      const tL = clamp01((p - 0.4 * d) / 0.18)
      const tA = clamp01((p - 0.12 - 0.5 * d) / 0.25)
      const tF = clamp01((p - 0.42 - 0.43 * d) / 0.15)
      const sA = as * (1 - 0.8 * easeOutCubic(tA))
      const line = B.edge[k] === 1 ? OUTLINE_S * easeOutCubic(tL) : 0
      const s1 = Math.max(sA, line)
      const eF = easeOutCubic(tF)
      s = s1 + (B.s[k] - s1) * eF
      const w = line + sA > 0 ? line / (line + sA) : 0
      const r1 = a[0] + (lineC[0] - a[0]) * w
      const g1 = a[1] + (lineC[1] - a[1]) * w
      const b1 = a[2] + (lineC[2] - a[2]) * w
      r = r1 + (b[0] - r1) * tF
      g = g1 + (b[1] - g1) * tF
      bl = b1 + (b[2] - b1) * tF
    } else {
      const t = clamp01((p - spread * d) / span)
      const e = easeOutCubic(t)
      s = as + (B.s[k] - as) * e
      // when one side is empty, keep the other side's colour so dots don't fade through grey
      const tc = as < 0.05 ? 1 : B.s[k] < 0.05 ? 0 : t
      r = a[0] + (b[0] - a[0]) * tc
      g = a[1] + (b[1] - a[1]) * tc
      bl = a[2] + (b[2] - a[2]) * tc
    }
    out.s[k] = s
    out.rgb[k * 3] = r
    out.rgb[k * 3 + 1] = g
    out.rgb[k * 3 + 2] = bl
  }
}
