// Shape generators sampled onto the shared 40×40 lattice (riset-ui/18 §C.5). Each shape is a size
// map (0..3, fractional allowed for anti-aliased edges) plus a colour id per cell and an edge mask
// used by the outline-first morph pass. Pure and deterministic.

import { boxDist, C, CELLS, clamp01, type ColorId, hash, MID, N, segDist } from './core'

export type Shape = { s: Float32Array; c: Uint8Array; edge: Uint8Array }
export type ShapeName = 'empty' | 'padlock' | 'receipt' | 'fingerprint' | 'block' | 'check' | 'alert' | 'clock'

type Cell = readonly [size: number, color: ColorId] | null

function build(fn: (x: number, y: number, i: number, j: number) => Cell): Shape {
  const s = new Float32Array(CELLS)
  const c = new Uint8Array(CELLS)
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const v = fn(i + 0.5, j + 0.5, i, j)
      if (!v || v[0] <= 0) continue
      s[j * N + i] = v[0]
      c[j * N + i] = v[1]
    }
  }
  const edge = new Uint8Array(CELLS)
  const on = (i: number, j: number) => i >= 0 && j >= 0 && i < N && j < N && s[j * N + i] > 0.6
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++)
      if (on(i, j) && (!on(i - 1, j) || !on(i + 1, j) || !on(i, j - 1) || !on(i, j + 1))) edge[j * N + i] = 1
  return { s, c, edge }
}

/** Quantise a 0..1 importance to the dot steps 1..3 with a little hash dither (halftone look). */
const tier = (imp: number, h: number) => Math.max(1, Math.min(3, Math.round(clamp01(imp + (h - 0.5) * 0.35) * 3)))

// ---- padlock (VaultSeal geometry re-sampled to 40 cells: check-mark keyhole, torn bottom) ---------
const LOCK = { x0: 9, x1: 31, y0: 18, y1: 33, r: 1.5, cx: 20, cy: 14.5, R: 7.6, rr: 4.4, leg: 18.5 }
const KEY: Array<[number, number]> = [
  [14.4, 24.6],
  [18.2, 28.4],
  [25.8, 20.8],
]
const keyDist = (x: number, y: number) =>
  Math.min(segDist(x, y, KEY[0][0], KEY[0][1], KEY[1][0], KEY[1][1]), segDist(x, y, KEY[1][0], KEY[1][1], KEY[2][0], KEY[2][1]))
const tri = (x: number, period: number) => {
  const p = (((x % period) + period) % period) / period
  return Math.abs(p - 0.5) * 2 // 1 at period edges, 0 mid
}

function padlock(): Shape {
  return build((x, y, i, j) => {
    const h = hash(i, j, 3)
    const lightSide = x + y * 0.6 < 33
    // body: rounded top, sawtooth (torn receipt) bottom, check-mark keyhole
    const bottom = LOCK.y1 - tri(x - LOCK.x0, 4) * 1.2
    const inBody = x >= LOCK.x0 && x <= LOCK.x1 && y >= LOCK.y0 && y <= bottom && boxDist(x, y, 20, 25.5, 11, 7.5, LOCK.r) < 0.2
    if (inBody) {
      const kd = keyDist(x, y)
      if (kd < 1.25) return null
      const edgeX = Math.min(x - LOCK.x0, LOCK.x1 - x, y - LOCK.y0, bottom - y)
      if (j === 31) return i % 2 ? [1.4, C.DOT] : null // perforation
      if (kd < 2.2) return [2.6, C.ICE] // keyhole rim reads as the check
      if (edgeX < 1) return [3, h < (lightSide ? 0.5 : 0.22) ? C.ICE : C.DOT2]
      const lum = 0.8 - 0.44 * ((x - LOCK.x0) / 22) - 0.14 * ((y - LOCK.y0) / 15) + (x > 10.5 && x < 12 ? 0.25 : 0)
      const tb = tier(0.2 + lum * 0.9, h)
      return tb < 2 ? null : [tb, lum > 0.62 ? C.DOT2 : C.DOT]
    }
    // shackle: upper half annulus + legs
    const d = Math.hypot(x - LOCK.cx, y - LOCK.cy)
    const legW = LOCK.R - LOCK.rr
    const inArc = y <= LOCK.cy && d >= LOCK.rr && d <= LOCK.R
    const inLeg =
      y > LOCK.cy && y <= LOCK.leg && ((x >= LOCK.cx - LOCK.R && x <= LOCK.cx - LOCK.R + legW) || (x >= LOCK.cx + LOCK.rr && x <= LOCK.cx + LOCK.R))
    if (!inArc && !inLeg) return null
    const t = inArc ? (d - LOCK.rr) / legW : x < LOCK.cx ? 1 - (x - (LOCK.cx - LOCK.R)) / legW : (x - (LOCK.cx + LOCK.rr)) / legW
    const ang = Math.atan2(y - LOCK.cy, x - LOCK.cx)
    const toLight = Math.max(0, Math.cos(ang - Math.atan2(-1, -1.15)))
    const lum = 0.3 + 0.4 * Math.sin(Math.PI * clamp01(t)) + 0.34 * toLight
    const rim = t < 0.2 || t > 0.8
    if (rim && h < (lightSide ? 0.45 : 0.2)) return [3, C.ICE]
    const ts = tier(0.25 + lum * 0.85, h)
    return ts < 2 ? null : [ts, lum > 0.6 ? C.DOT2 : C.DOT]
  })
}

// ---- receipt ----------------------------------------------------------------------------------
/** Receipt geometry, exported so callouts can dock onto the rows. */
export const RECEIPT = {
  x0: 8,
  x1: 32,
  top: 4,
  bottom: 36,
  header: 8,
  labelX: 11,
  valueX: 15,
  /** WHO, DID, WHY, BASIS */
  rows: [13, 17, 21, 25] as const,
  lens: [13, 15, 10, 12] as const,
  perf: 29,
  footer: 32,
}
export const DID_ROW = RECEIPT.rows[1]
const DID_MAX = RECEIPT.lens[1]

type ReceiptOpts = { typed: boolean; didCells: number; alert: boolean }

function receipt({ typed, didCells, alert }: ReceiptOpts): Shape {
  const R = RECEIPT
  return build((x, y, i, j) => {
    const top = R.top + tri(x - R.x0, 4)
    const bottom = R.bottom - tri(x - R.x0, 4)
    if (x < R.x0 || x > R.x1 || y < top || y > bottom) return null
    const h = hash(i, j, 11)
    const isEdge = x < R.x0 + 1 || x > R.x1 - 1 || y < top + 1 || y > bottom - 1
    if (isEdge) return [2.4, alert ? C.BAD : C.DOT2]
    const paper: Cell = null // empty paper: no filler dots
    const blank = paper
    // header: company name in bold dots
    if (j === R.header) return i >= R.labelX && i < R.labelX + 14 ? (typed ? [3, C.DOT2] : blank) : paper
    const row = (R.rows as readonly number[]).indexOf(j)
    if (row >= 0) {
      const isDid = row === 1
      if (alert && isDid) return i >= R.labelX && i < R.x1 - 2 ? [3.2, C.BAD] : paper
      if (i >= R.labelX && i < R.labelX + 3) return typed ? [3, C.ICE] : blank
      const len = isDid ? didCells : R.lens[row]
      if (i >= R.valueX && i < R.valueX + len) return typed ? [2.2, C.DOT2] : blank
      return paper
    }
    if (alert && Math.abs(j - DID_ROW) <= 2 && h < 0.5) return [1.6, C.BAD]
    if (j === R.perf) return i % 2 ? [1.8, C.DOT] : null
    if (j === R.footer) return i >= R.labelX && i < R.x1 - 3 ? (typed && h < 0.72 ? [2, C.ICE] : blank) : paper
    return paper
  })
}

// ---- fingerprint: 7 broken elliptical arcs, slightly drifting centres -------------------------
export const PRINT = { cx: 20, cy: 21 }
function fingerprint(): Shape {
  return build((x, y, i, j) => {
    for (let k = 0; k < 7; k++) {
      const rx = 1.6 + 2 * k
      const ry = rx * 1.2
      const cy = PRINT.cy + k * 0.25
      const dx = x - PRINT.cx
      const dy = y - cy
      const e = Math.hypot(dx / rx, dy / ry)
      const d = (e - 1) * rx
      if (Math.abs(d) > 0.62) continue
      // gaps: one hash-seeded break per arc, plus an open bottom on the outer arcs (whorl)
      const ang = Math.atan2(dy, dx)
      const gap = hash(k, 7, 5) * Math.PI * 2 - Math.PI
      const da = Math.abs(((ang - gap + Math.PI * 3) % (Math.PI * 2)) - Math.PI)
      if (da < 0.42 / Math.max(1, k * 0.5)) return null
      if (k >= 4 && ang > 0.9 && ang < 2.25) return null
      const w = 1 - Math.abs(d) / 0.62
      return [1.4 + 1.5 * w, hash(i, j, 2) < 0.18 ? C.DOT2 : C.ICE]
    }
    return null
  })
}

// ---- block: chain of rounded squares; `offset` slides the chain left (whole cells, dot-matrix step) --
/** 9×9 links (corner cells dropped), 2-cell gaps bridged by two rails, pitch 11. `ours` is the ice block. */
export const LINK = { w: 9, gap: 2, x0: 4, y0: 15, ours: 2 }
const LINK_P = LINK.w + LINK.gap // 11

function block(offset: number): Shape {
  const off = Math.round(offset)
  const dim = off >= LINK_P / 2
  return build((_x, _y, i, j) => {
    const lj = j - LINK.y0
    for (let k = 0; k < 4; k++) {
      const lx = LINK.x0 + LINK_P * k - off
      if (lx < 0 || lx + LINK.w > N) continue // a link leaving the grid is dropped, never shown as a sliver
      const li = i - lx
      if (li < 0 || li >= LINK.w || lj < 0 || lj >= LINK.w) continue
      const e = LINK.w - 1
      const edgeX = li === 0 || li === e
      const edgeY = lj === 0 || lj === e
      if (edgeX && edgeY) return null // rounded corner
      if (k === LINK.ours) return [edgeX || edgeY ? 2.7 : 3, C.ICE]
      const old = k === 0 && dim
      if (edgeX || edgeY) return [2.6, old ? C.DOT : C.DOT2]
      return null
    }
    // two rails bridging each gap
    if (lj === 3 || lj === 5) {
      for (let k = 0; k < 3; k++) {
        const a = LINK.x0 + LINK_P * k - off + LINK.w
        if (a - LINK.w < 0 || a + LINK.gap + LINK.w > N) continue
        if (i >= a && i < a + LINK.gap) return [2.3, k === 0 && dim ? C.DOT : C.DOT2]
      }
    }
    return null
  })
}

// ---- check: thick polyline inside a faint ring ------------------------------------------------
export const TICK: Array<[number, number]> = [
  [10.5, 21],
  [17, 27.5],
  [30, 12.5],
]
function check(done: boolean): Shape {
  return build((x, y) => {
    const d = Math.min(segDist(x, y, TICK[0][0], TICK[0][1], TICK[1][0], TICK[1][1]), segDist(x, y, TICK[1][0], TICK[1][1], TICK[2][0], TICK[2][1]))
    if (d < 2.5) return [3, done ? C.OK : C.ICE]
    return null
  })
}

// ---- clock: ring, ticks, two hands; `param` = elapsed share of the 72 h window ------------------
function clock(param: number): Shape {
  const elapsed = clamp01(param)
  const aM = -Math.PI / 2 + elapsed * Math.PI * 2 * 6
  const aH = -Math.PI / 2 + elapsed * Math.PI * 2
  return build((x, y) => {
    const dx = x - MID
    const dy = y - MID
    const r = Math.hypot(dx, dy)
    let a = Math.atan2(dy, dx) + Math.PI / 2
    if (a < 0) a += Math.PI * 2
    if (Math.abs(r - 16) < 0.75) return a / (Math.PI * 2) < elapsed ? null : [2.7, C.ICE]
    if (r > 12 && r < 13.6) {
      const k = Math.round(a / (Math.PI / 6))
      if (Math.abs(a - k * (Math.PI / 6)) * r < 0.7) return [k % 3 === 0 ? 2.8 : 1.8, C.DOT2]
    }
    if (r < 1.6) return [3, C.ICE]
    if (segDist(x, y, MID, MID, MID + Math.cos(aM) * 11, MID + Math.sin(aM) * 11) < 0.75) return [2.6, C.ICE]
    if (segDist(x, y, MID, MID, MID + Math.cos(aH) * 7, MID + Math.sin(aH) * 7) < 1.05) return [3, C.DOT2]
    return null
  })
}

// ---- cache ------------------------------------------------------------------------------------
const cache = new Map<string, Shape>()
function memo(key: string, make: () => Shape): Shape {
  let v = cache.get(key)
  if (!v) {
    v = make()
    if (cache.size > 160) cache.clear()
    cache.set(key, v)
  }
  return v
}

export const shapes = {
  empty: () => memo('empty', () => build(() => null)),
  padlock: () => memo('padlock', padlock),
  receiptBlank: () => memo('receipt0', () => receipt({ typed: false, didCells: DID_MAX, alert: false })),
  /** `didCells` = length of the DID value run (shrinks while the insider retypes it). */
  receipt: (didCells: number = DID_MAX) => memo(`receipt${didCells}`, () => receipt({ typed: true, didCells, alert: false })),
  alert: (didCells: number = 3) => memo(`alert${didCells}`, () => receipt({ typed: true, didCells, alert: true })),
  fingerprint: () => memo('print', fingerprint),
  /** Offsets snap to whole cells. */
  block: (offset = 0) => memo(`block${Math.round(offset)}`, () => block(offset)),
  check: () => memo('check', () => check(false)),
  checkDone: () => memo('check1', () => check(true)),
  clock: (param = 0.25) => memo(`clock${Math.round(param * 288)}`, () => clock(Math.round(param * 288) / 288)),
}

export const DID_FULL = DID_MAX
export const LINK_PITCH = LINK_P

/** Named shapes for `LatticeObject`. */
export function namedShape(name: ShapeName, param?: number): Shape {
  switch (name) {
    case 'empty':
      return shapes.empty()
    case 'padlock':
      return shapes.padlock()
    case 'receipt':
      return shapes.receipt()
    case 'fingerprint':
      return shapes.fingerprint()
    case 'block':
      return shapes.block(param ?? 0)
    case 'check':
      return param ? shapes.checkDone() : shapes.check()
    case 'alert':
      return shapes.alert()
    case 'clock':
      return shapes.clock(param)
  }
}
