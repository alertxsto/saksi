// Dot-matrix cells for the system screens (404, reconnecting, OG). Same 40×40 lattice, colour ids and
// dot steps as the landing objects (components/landing/lattice), but returned as a sparse list so the
// art can be server-rendered as SVG and animated per group in CSS (globals.css, SYSTEM block).

import { C, type ColorId, hash, MID, N, PALETTES, segDist } from '@/components/landing/lattice/core'
import { RECEIPT, shapes, type Shape } from '@/components/landing/lattice/shapes'

export type Cell = { i: number; j: number; s: number; c: ColorId; k?: number }

/** Radius per dot step in cell units (matches the canvas renderer: 0.107 × pitch). */
export const R_STEP = 0.107
export const VAULT = PALETTES.vault.map(([r, g, b]) => `rgb(${r},${g},${b})`)

/** Radial entrance delay (ms) from the centre of the lattice. */
export const delay = (i: number, j: number) => Math.round(Math.hypot(i + 0.5 - MID, j + 0.5 - MID) * 16)

export function fromShape(shape: Shape): Cell[] {
  const out: Cell[] = []
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const s = shape.s[j * N + i]
      if (s >= 0.7) out.push({ i, j, s, c: shape.c[j * N + i] as ColorId })
    }
  return out
}

/**
 * 404: a receipt that was never filled in, and never sealed, so no ice anywhere. Torn edges and perforation
 * follow the landing receipt (empty paper, no filler dots); the field lines stay blank dotted rules.
 */
export function blankReceipt(): Cell[] {
  const R = RECEIPT
  const blank = shapes.receiptBlank()
  const fields = new Set<number>([R.header, ...R.rows, R.footer])
  const out: Cell[] = []
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const k = j * N + i
      const x = i + 0.5
      const y = j + 0.5
      if (blank.s[k] >= 0.7) {
        // outline: fuller dots, a little lighter on the lit side
        const lit = x + y * 0.6 < 30
        out.push({ i, j, s: blank.c[k] === C.DOT ? 1.8 : 2.8, c: blank.c[k] === C.DOT ? C.DOT : lit || hash(i, j, 21) < 0.3 ? C.DOT2 : C.DOT })
        continue
      }
      const top = R.top + 1
      if (i <= R.x0 || i >= R.x1 - 1 || j <= top || j >= R.bottom - 2) continue
      if (fields.has(j)) {
        const end = j === R.header ? R.labelX + 14 : j === R.footer ? R.x1 - 3 : R.valueX + R.lens[R.rows.indexOf(j as (typeof R.rows)[number])]
        // blank field: a dotted rule where the label and value would be printed
        if (i >= R.labelX && i < end && i % 2 === 1) out.push({ i, j, s: j === R.header ? 1.9 : 1.5, c: C.DOT })
      }
    }
  return out
}

/** Lens start position (cell centre) and its ring; coordinates are relative to that centre. */
export const LENS = { cx: 15, cy: 14, r: 4.4 }
/** The searcher's lens is vault-ink ("verified by you" on the landing legend), shadowed bottom right. */
export function lens(): { ring: Cell[]; glass: Array<[number, number]> } {
  const ring: Cell[] = []
  const glass: Array<[number, number]> = []
  for (let j = -7; j <= 10; j++)
    for (let i = -7; i <= 10; i++) {
      const d = Math.hypot(i, j)
      const h = hash(i + 40, j + 40, 5)
      if (Math.abs(d - LENS.r) < 0.95) {
        const shadow = i + j > 2
        ring.push({ i, j, s: 2.9, c: shadow ? (h < 0.6 ? C.DOT2 : C.INK) : h < 0.85 ? C.INK : C.DOT2 })
      } else if (d < LENS.r) glass.push([i, j])
      else if (segDist(i, j, 3.9, 3.9, 8.6, 8.6) < 1.05) ring.push({ i, j, s: 3, c: i + j > 13 ? C.DOT : C.DOT2 })
    }
  return { ring, glass }
}

/**
 * Reconnecting: two links on the left (this server's database copy, dot-2), a solid ice link on the right
 * (the chain), and a broken bridge between them whose rail cells carry `k` (0..4) for the travelling packets.
 */
export const CHAIN = { y0: 15, w: 9, links: [2, 13, 29] as const, gap: [22, 28] as const }
export function chain(): { links: Cell[]; packets: Cell[]; chainLink: Cell[] } {
  const links: Cell[] = []
  const packets: Cell[] = []
  const chainLink: Cell[] = []
  const e = CHAIN.w - 1
  CHAIN.links.forEach((x0, n) => {
    for (let lj = 0; lj < CHAIN.w; lj++)
      for (let li = 0; li < CHAIN.w; li++) {
        const edgeX = li === 0 || li === e
        const edgeY = lj === 0 || lj === e
        if (edgeX && edgeY) continue
        const cell = { i: x0 + li, j: CHAIN.y0 + lj }
        const h = hash(cell.i, cell.j, 9)
        if (n === 2) {
          // the chain: solid ice, a few dot-2 flecks on the shadow side (the hero padlock's rim treatment)
          const shadow = li + lj > 9
          chainLink.push({ ...cell, s: edgeX || edgeY ? 2.8 : 3, c: shadow && h < 0.25 ? C.DOT2 : C.ICE })
        } else if (edgeX || edgeY) links.push({ ...cell, s: 2.8, c: li + lj < 6 && h < 0.5 ? C.INK : C.DOT2 })
      }
  })
  for (const lj of [3, 5]) {
    const j = CHAIN.y0 + lj
    for (const i of [11, 12]) links.push({ i, j, s: 2.4, c: C.DOT2 })
    links.push({ i: CHAIN.gap[0], j, s: 2.4, c: C.DOT2 })
    for (let k = 0; k < 5; k++) packets.push({ i: CHAIN.gap[0] + 1 + k, j, s: 2.4, c: C.ICE, k })
    chainLink.push({ i: CHAIN.gap[1], j, s: 2.4, c: C.ICE })
  }
  return { links, packets, chainLink }
}

/** OG / brand: the landing padlock. */
export const padlock = () => fromShape(shapes.padlock())
