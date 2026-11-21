// The Witness film (riset-ui/18 §C.6): five beats on one lattice object. Everything is a pure
// function of T = beatIndex + q (0..5), so scrolling back up un-types the edit and retracts the red.

import { C, CELLS, clamp01, easeOutBack, hash, N, PALETTES, win } from './core'
import { delayMap, type Frame, morph, paint } from './morph'
import { DID_FULL, DID_ROW, LINK, LINK_PITCH, PRINT, RECEIPT, type Shape, shapes, TICK } from './shapes'

export const BEATS = [
  { id: 'record', word: 'RECORD', vh: 115 },
  { id: 'seal', word: 'SEAL', vh: 125 },
  { id: 'verify', word: 'VERIFY', vh: 95 },
  { id: 'edit', word: 'EDIT', vh: 100 },
  { id: 'altered', word: 'ALTERED', vh: 105 },
] as const
export type BeatId = (typeof BEATS)[number]['id']
export const PIN_VH = BEATS.reduce((a, b) => a + b.vh, 0) // 540

/** Pin progress P (0..1) → T (0..5). */
export function toT(P: number): number {
  let acc = 0
  const v = clamp01(P) * PIN_VH
  for (let k = 0; k < BEATS.length; k++) {
    const len = BEATS[k].vh
    if (v <= acc + len || k === BEATS.length - 1) return k + clamp01((v - acc) / len)
    acc += len
  }
  return BEATS.length
}

// ---- the insider edit ---------------------------------------------------------------------------
export const DID_BEFORE = 'SHARED WITH THIRD PARTY'
export const DID_AFTER = 'READ'

/** Text in the database's DID field at film time T (EDIT is beat 3). */
export function didText(T: number): string {
  if (T < 3.4) return DID_BEFORE
  if (T < 3.7) return DID_BEFORE.slice(0, Math.round(DID_BEFORE.length * (1 - win(T, 3.4, 3.7))))
  if (T < 3.92) return DID_AFTER.slice(0, Math.ceil(DID_AFTER.length * win(T, 3.7, 3.92)))
  return DID_AFTER
}
const didCells = (text: string) => (text.length ? Math.max(1, Math.round((DID_FULL * text.length) / DID_BEFORE.length)) : 0)

// ---- lattice frame ------------------------------------------------------------------------------
const V = PALETTES.vault
const RADIAL = delayMap({ kind: 'radial' })
const ANGULAR = delayMap({ kind: 'angular' })
const TO_BLOCK = delayMap({ kind: 'radial', x: LINK.x0 + LINK_PITCH * LINK.ours + LINK.w / 2, y: LINK.y0 + LINK.w / 2 })
const TYPE = delayMap({ kind: 'rows', rows: [RECEIPT.header, ...RECEIPT.rows, RECEIPT.footer], x0: RECEIPT.labelX, x1: RECEIPT.x1 - 2 })
const FROM_DID = delayMap({ kind: 'row', y: DID_ROW })
const BLOCK_END = LINK_PITCH

/** Write the lattice for beat `b` at local progress `q` into `out`. `now` drives the ambient pulse only. */
export function storyFrame(out: Frame, b: number, q: number, now = 0): void {
  switch (b) {
    case 0: // RECORD: padlock → blank receipt (outline first), then the rows type in
      if (q < 0.42) morph(out, shapes.padlock(), shapes.receiptBlank(), win(q, 0.03, 0.42), RADIAL, V, { outline: true })
      else morph(out, shapes.receiptBlank(), shapes.receipt(), win(q, 0.42, 0.86), TYPE, V, { spread: 0.9, span: 0.1 })
      return
    case 1: // SEAL: receipt swirls into a fingerprint, pulses, funnels into the chain, chain shifts
      if (q < 0.3) morph(out, shapes.receipt(), shapes.fingerprint(), q / 0.3, ANGULAR, V, { outline: true })
      else if (q < 0.45) {
        paint(out, shapes.fingerprint(), V)
        const u = win(q, 0.3, 0.45)
        const front = u * 24
        for (let k = 0; k < CELLS; k++) {
          if (out.s[k] < 0.1) continue
          const d = Math.hypot((k % N) + 0.5 - PRINT.cx, Math.floor(k / N) + 0.5 - PRINT.cy) - front
          out.s[k] += Math.exp(-(d * d) / 5) * 1.1
        }
      } else if (q < 0.75) morph(out, shapes.fingerprint(), shapes.block(0), win(q, 0.45, 0.75), TO_BLOCK, V, { spread: 0.7, span: 0.3 })
      else paint(out, shapes.block(BLOCK_END * easeOutBack(win(q, 0.75, 0.9))), V)
      return
    case 2: // VERIFY: chain → check (outline first), then a radial ice → ok sweep
      if (q < 0.35) morph(out, shapes.block(BLOCK_END), shapes.check(), q / 0.35, RADIAL, V, { outline: true })
      else morph(out, shapes.check(), shapes.checkDone(), win(q, 0.35, 0.8), RADIAL, V, { spread: 0.85, span: 0.15 })
      if (q > 0.8) {
        // a glint runs once along the check stroke, scrubbed by scroll
        const u = win(q, 0.8, 1)
        const amp = Math.sin(Math.PI * u) * 0.9
        const [p0, p1, p2] = TICK
        const l1 = Math.hypot(p1[0] - p0[0], p1[1] - p0[1])
        const l2 = Math.hypot(p2[0] - p1[0], p2[1] - p1[1])
        const head = u * (l1 + l2)
        for (let k = 0; k < CELLS; k++) {
          if (out.s[k] < 2) continue
          const x = (k % N) + 0.5
          const y = Math.floor(k / N) + 0.5
          // arc length of the nearest point on the polyline
          const t1 = clamp01(((x - p0[0]) * (p1[0] - p0[0]) + (y - p0[1]) * (p1[1] - p0[1])) / (l1 * l1))
          const t2 = clamp01(((x - p1[0]) * (p2[0] - p1[0]) + (y - p1[1]) * (p2[1] - p1[1])) / (l2 * l2))
          const d1 = Math.hypot(x - (p0[0] + t1 * (p1[0] - p0[0])), y - (p0[1] + t1 * (p1[1] - p0[1])))
          const d2 = Math.hypot(x - (p1[0] + t2 * (p2[0] - p1[0])), y - (p1[1] + t2 * (p2[1] - p1[1])))
          const s = d1 < d2 ? t1 * l1 : l1 + t2 * l2
          const dd = head - s
          if (dd >= 0 && dd < 4) out.s[k] += amp * (1 - dd / 4)
        }
      }
      return
    case 3: {
      // EDIT: check → receipt (green → ice), then the DID row flickers and is retyped
      if (q < 0.3) {
        morph(out, shapes.checkDone(), shapes.receipt(), q / 0.3, RADIAL, V, { outline: true })
        return
      }
      paint(out, shapes.receipt(didCells(didText(3 + q))), V)
      if (q < 0.92) {
        const tick = Math.floor(q * 120)
        const dot = V[C.DOT]
        for (let i = RECEIPT.valueX; i < RECEIPT.x1 - 1; i++) {
          const k = DID_ROW * N + i
          if (out.s[k] < 1.5) continue
          const on = hash(i, tick, 4) > 0.35
          out.s[k] = on ? 2.2 : 1
          if (!on) {
            out.rgb[k * 3] = dot[0]
            out.rgb[k * 3 + 1] = dot[1]
            out.rgb[k * 3 + 2] = dot[2]
          }
        }
      }
      return
    }
    default: {
      // ALTERED: red spreads outward from the edited row; then the outline breathes
      const fin = didCells(DID_AFTER)
      if (q < 0.4) {
        morph(out, shapes.receipt(fin), shapes.alert(fin), q / 0.4, FROM_DID, V, { spread: 0.75, span: 0.25 })
        return
      }
      const A = shapes.alert(fin)
      paint(out, A, V)
      // red rings keep rolling out of the edited row as you scroll (and breathe while you rest)
      const amp = win(q, 0.42, 0.55) * 0.3
      const phase = q * 26 + (now / 2400) * Math.PI * 2
      for (let k = 0; k < CELLS; k++) {
        if (A.c[k] !== C.BAD) continue
        const d = Math.hypot(Math.floor(k / N) - DID_ROW, ((k % N) - N / 2) * 0.35)
        out.s[k] *= 1 + amp * Math.sin(phase - d * 0.7)
      }
    }
  }
}

export function storyFrameAtT(out: Frame, T: number, now = 0) {
  const b = Math.min(BEATS.length - 1, Math.floor(T))
  storyFrame(out, b, T >= BEATS.length ? 1 : T - b, now)
}


// ---- callouts (blueprint plates) ----------------------------------------------------------------
export type Tone = 'ice' | 'ok' | 'bad'
export type CalloutDef = {
  id: string
  tag: string
  value: string
  tone: Tone
  /** Anchor = centre of the dot it describes (cell units). */
  at: readonly [number, number]
  /** Row of the plate (cell units). The leader runs vertically from the anchor, then right. */
  plateY: number
  /** T when it enters, becomes "previous" (dimmed), exits. */
  t: readonly [enter: number, prev: number, out: number]
  /** Value is the live DID field. */
  live?: boolean
  dot?: boolean
}

/** Centre of the right-most dot in row `j` of `S` (optionally only dots at least `minS`). */
function lastDot(S: Shape, j: number, minS = 0.7): readonly [number, number] {
  for (let i = N - 1; i >= 0; i--) if (S.s[j * N + i] >= minS) return [i + 0.5, j + 0.5]
  return [N / 2, j + 0.5]
}
const OURS_X = LINK.x0 + LINK_PITCH * (LINK.ours - 1) + (LINK.w - 1) / 2 + 0.5 // ours after the shift
const EDGE_X = RECEIPT.x1 - 0.5 // receipt's right edge column
const C_ROW = (j: number) => [EDGE_X, j + 0.5] as const

function defs(): CalloutDef[] {
  const who = lastDot(shapes.receipt(), RECEIPT.rows[0], 2)
  const did = lastDot(shapes.receipt(), RECEIPT.rows[1], 2)
  const why = lastDot(shapes.receipt(), RECEIPT.rows[2], 2)
  const fp = lastDot(shapes.fingerprint(), 11)
  const tick = lastDot(shapes.checkDone(), 13, 2.9)
  const ring = lastDot(shapes.checkDone(), 27, 2.9) // the check's lower vertex
  return [
    { id: 'who', tag: 'WHO', value: 'Contoh Lending Co.', tone: 'ice', at: who, plateY: who[1], t: [0.49, 1.04, 1.42] },
    { id: 'did', tag: 'DID', value: DID_BEFORE, tone: 'ice', at: did, plateY: did[1], t: [0.58, 1.04, 1.42] },
    { id: 'why', tag: 'WHY', value: 'Debt collection', tone: 'ice', at: why, plateY: why[1], t: [0.67, 1.04, 1.42] },
    { id: 'fp', tag: 'FINGERPRINT', value: '0x3fa2…9c1d', tone: 'ice', at: fp, plateY: fp[1], t: [1.3, 1.5, 1.62] },
    { id: 'block', tag: 'BLOCK', value: '#7,123,242', tone: 'ice', at: [OURS_X, LINK.y0 + 0.5], plateY: LINK.y0 - 5.5, t: [1.86, 2.04, 2.3] },
    { id: 'sealed', tag: 'SEALED', value: '21 Nov 14:03 WIB', tone: 'ok', at: [OURS_X, LINK.y0 + LINK.w - 0.5], plateY: LINK.y0 + LINK.w + 4.5, t: [1.91, 2.04, 2.3] },
    { id: 'verified', tag: 'VERIFIED', value: 'By your phone', tone: 'ok', at: tick, plateY: tick[1], t: [2.42, 3.02, 3.14] },
    { id: 'time', tag: 'MATCH', value: '1.8 S', tone: 'ok', at: ring, plateY: ring[1], t: [2.6, 3.02, 3.14], dot: true },
    { id: 'edit', tag: 'DID', value: DID_BEFORE, tone: 'ice', at: C_ROW(DID_ROW), plateY: DID_ROW + 0.5, t: [3.3, 4.3, 4.4], live: true },
    { id: 'altered', tag: 'ALTERED', value: 'DID changed', tone: 'bad', at: C_ROW(DID_ROW), plateY: DID_ROW + 0.5, t: [4.42, 99, 99] },
    { id: 'chain', tag: 'SEALED', value: '0x3fa2…9c1d', tone: 'ice', at: C_ROW(RECEIPT.rows[3]), plateY: RECEIPT.rows[3] + 0.5, t: [4.56, 99, 99] },
    { id: 'now', tag: 'NOW', value: '0x7be0…41a6', tone: 'bad', at: C_ROW(RECEIPT.perf), plateY: RECEIPT.perf + 0.5, t: [4.68, 99, 99] },
  ]
}
export const CALLOUTS: readonly CalloutDef[] = defs()

const DIG = '0123456789'
const HEX = '0123456789abcdef'
const UP = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const LO = 'abcdefghijklmnopqrstuvwxyz'
/**
 * Scroll-scrubbed scramble: `r` (0..1) of the text resolved left to right. Unresolved characters keep
 * their class (digit → digit, hex → hex, letter → same-case letter); punctuation never changes.
 */
export function scrambleText(text: string, r: number, seed: number): string {
  if (r >= 1) return text
  const hex = text.startsWith('0x')
  const n = Math.floor(text.length * clamp01(r))
  let s = text.slice(0, n)
  for (let i = n; i < text.length; i++) {
    const ch = text[i]
    const set = hex ? (i < 2 || !/[0-9a-f]/.test(ch) ? '' : HEX) : /[0-9]/.test(ch) ? DIG : /[A-Z]/.test(ch) ? UP : /[a-z]/.test(ch) ? LO : ''
    s += set ? set[Math.floor(hash(i, seed, 13) * set.length)] : ch
  }
  return s
}
