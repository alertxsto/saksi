// Vault Seal — Saksi's dot-matrix padlock. ORIGINAL shape: a padlock whose keyhole is a check
// mark and whose body ends in a torn receipt edge with a perforation line.
//
// Dots are computed once per module load from a pure shape function (no images, no WebGL),
// quantised to 4 diameters (1.4 / 2.8 / 4.2 / 5.6 px) on an 8 px pitch inside a 672 px board
// (14 × 14 grid of 48 px cells). About a quarter of the dots are "ice" and trace the edges.
// Deterministic, so server and client markup are identical.

import type { CSSProperties } from 'react'

const BOARD = 672
const PITCH = 8
const N = BOARD / PITCH // 84 dot cells per side
const RADII = [0.7, 1.4, 2.1, 2.8] as const

// ---- geometry (in dot-cell units) -----------------------------------------------------------
const BODY = { x0: 19, x1: 65, y0: 37, y1: 69, r: 3 }
const SH = { cx: 42, cy: 31, R: 15.5, r: 9.5, legBottom: 38 }
const CHECK: Array<[number, number]> = [
  [30, 52],
  [38.5, 60.5],
  [54, 44.5],
]
const CHECK_HALF = 2.4
const PERF_ROW = 64
const LIGHT = { x: 18, y: 12 }
const CENTER = { x: 42, y: 50 }

function hash(i: number, j: number, k = 0): number {
  let h = Math.imul(i * 374761393 + j * 668265263 + k * 2147483647, 1274126177)
  h = Math.imul(h ^ (h >>> 13), 1103515245)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax
  const dy = by - ay
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

function checkDist(x: number, y: number) {
  return Math.min(
    segDist(x, y, CHECK[0][0], CHECK[0][1], CHECK[1][0], CHECK[1][1]),
    segDist(x, y, CHECK[1][0], CHECK[1][1], CHECK[2][0], CHECK[2][1]),
  )
}

/** Bottom edge of the body: a torn-receipt sawtooth. */
function bodyBottom(x: number) {
  const p = ((x - BODY.x0) % 4 + 4) % 4
  return BODY.y1 - Math.abs(p - 2)
}

type Region = 'body' | 'shackle' | null

function region(x: number, y: number): Region {
  // body (rounded top corners, sawtooth bottom), minus the check-mark keyhole
  if (x >= BODY.x0 && x <= BODY.x1 && y >= BODY.y0 && y <= bodyBottom(x)) {
    const cx = x < BODY.x0 + BODY.r ? BODY.x0 + BODY.r : x > BODY.x1 - BODY.r ? BODY.x1 - BODY.r : x
    if (y < BODY.y0 + BODY.r && Math.hypot(x - cx, y - (BODY.y0 + BODY.r)) > BODY.r && cx !== x) return null
    if (checkDist(x, y) < CHECK_HALF) return null
    return 'body'
  }
  // shackle: upper half-annulus + two legs
  const d = Math.hypot(x - SH.cx, y - SH.cy)
  if (y <= SH.cy && d >= SH.r && d <= SH.R) return 'shackle'
  const legW = SH.R - SH.r
  if (y > SH.cy && y <= SH.legBottom) {
    if (x >= SH.cx - SH.R && x <= SH.cx - SH.R + legW) return 'shackle'
    if (x >= SH.cx + SH.r && x <= SH.cx + SH.r + legW) return 'shackle'
  }
  return null
}

function luminance(x: number, y: number, reg: Exclude<Region, null>): number {
  if (reg === 'body') {
    let l = 0.8 - 0.44 * ((x - BODY.x0) / (BODY.x1 - BODY.x0)) - 0.14 * ((y - BODY.y0) / (BODY.y1 - BODY.y0))
    if (x >= 22 && x <= 24.5 && y < 60) l += 0.3 // vertical specular stripe
    return Math.max(0, Math.min(1, l))
  }
  const legW = SH.R - SH.r
  let t: number
  if (y <= SH.cy) t = (Math.hypot(x - SH.cx, y - SH.cy) - SH.r) / legW
  else t = x < SH.cx ? 1 - (x - (SH.cx - SH.R)) / legW : (x - (SH.cx + SH.r)) / legW
  const ang = Math.atan2(y - SH.cy, x - SH.cx)
  const toLight = Math.max(0, Math.cos(ang - Math.atan2(-1, -1.15)))
  return Math.max(0, Math.min(1, 0.28 + 0.42 * Math.sin(Math.PI * Math.max(0, Math.min(1, t))) + 0.34 * toLight))
}

export type Dot = {
  x: number
  y: number
  r: number
  sq: number // 0 = circle, n = rounded square run of n cells
  cls: 'd0' | 'd1' | 'di'
  g: -1 | 0 | 1 | 2
  d: number // glint delay (ms)
  c: number // centre distance delay (ms)
}

function compute(): Dot[] {
  const mask: Region[][] = []
  for (let j = 0; j < N; j++) {
    mask.push([])
    for (let i = 0; i < N; i++) mask[j].push(region(i + 0.5, j + 0.5))
  }
  const at = (i: number, j: number) => (i < 0 || j < 0 || i >= N || j >= N ? null : mask[j][i])

  const raw: Array<Dot & { i: number; j: number; tier: number }> = []
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const reg = mask[j][i]
      if (!reg) continue
      const x = i + 0.5
      const y = j + 0.5
      const lum = luminance(x, y, reg)
      const edge =
        !at(i - 1, j) || !at(i + 1, j) || !at(i, j - 1) || !at(i, j + 1) ? 1 : !at(i - 1, j - 1) || !at(i + 1, j + 1) || !at(i + 1, j - 1) || !at(i - 1, j + 1) ? 0.5 : 0
      const h = hash(i, j)
      const h2 = hash(i, j, 7)
      const lightSide = x + y * 0.6 < 66

      // perforation line across the body (receipt tear)
      if (reg === 'body' && j === PERF_ROW) {
        if (i % 2 === 0) continue
        raw.push({ i, j, x, y, r: RADII[1], sq: 0, cls: 'd1', g: 0, d: 0, c: 0, tier: 1 })
        continue
      }

      let cls: Dot['cls'] = 'd0'
      if (edge === 1 && h < (lightSide ? 0.7 : 0.32)) cls = 'di'
      else if (lum > 0.8 && h < 0.85) cls = 'di'
      else if (lum > 0.6) cls = 'd1'

      // sparse dots in the deepest shadow so the form reads
      if (cls !== 'di' && (h2 < 0.2 || (lum < (reg === 'shackle' ? 0.32 : 0.45) && h2 < 0.5))) continue

      // halftone: lighter cells get bigger dots, with a little hash jitter
      const imp = Math.max(0, Math.min(1, 0.15 + lum * 0.95 + edge * 0.15 + (h2 - 0.5) * 0.45))
      let tier = Math.round(imp * 3)
      if (cls === 'di') tier = Math.max(1, Math.min(3, tier + (h2 < 0.3 ? 1 : 0)))
      const sq = cls !== 'di' && tier === 3 && h2 > 0.62 ? 1 : 0

      let g: Dot['g'] = -1
      if (cls !== 'di') {
        if (reg === 'body' && j > PERF_ROW && h < 0.75) g = 0
        else if (reg === 'shackle' && h < 0.34) g = 1
        else if (reg === 'body' && checkDist(x, y) < CHECK_HALF + 1.6 && h < 0.9) g = 2
      }

      raw.push({
        i,
        j,
        x,
        y,
        r: RADII[tier],
        sq,
        cls,
        g,
        d: Math.round(Math.hypot(x - LIGHT.x, y - LIGHT.y) * 28),
        c: Math.round(Math.hypot(x - CENTER.x, y - CENTER.y) * 16),
        tier,
      })
    }
  }

  // merge horizontal runs of rounded squares into pills (max 5 cells)
  const out: Dot[] = []
  for (let k = 0; k < raw.length; k++) {
    const a = raw[k]
    if (a.sq) {
      let n = 1
      while (
        n < 5 &&
        raw[k + n] &&
        raw[k + n].sq &&
        raw[k + n].j === a.j &&
        raw[k + n].i === a.i + n &&
        raw[k + n].cls === a.cls &&
        raw[k + n].g === a.g
      ) {
        n++
      }
      out.push({ x: a.x, y: a.y, r: a.r, sq: n, cls: a.cls, g: a.g, d: a.d, c: a.c })
      k += n - 1
    } else {
      out.push({ x: a.x, y: a.y, r: a.r, sq: 0, cls: a.cls, g: a.g, d: a.d, c: a.c })
    }
  }
  return out
}

let cache: Dot[] | null = null
export function sealDots(): Dot[] {
  if (!cache) cache = compute()
  return cache
}

const f1 = (n: number) => Math.round(n * 10) / 10

/** Board grid lines + registration squares (zaro-style). */
function Board() {
  const q = BOARD / 14
  const lines = []
  for (let k = 1; k < 14; k++) {
    lines.push(<line key={`v${k}`} x1={k * q} y1={0} x2={k * q} y2={BOARD} />)
    lines.push(<line key={`h${k}`} x1={0} y1={k * q} x2={BOARD} y2={k * q} />)
  }
  const sq: Array<[number, number]> = [
    [1, 1],
    [13, 1],
    [1, 13],
    [13, 13],
    [7, 0],
    [0, 7],
    [14, 7],
    [7, 14],
  ]
  return (
    <g>
      <g stroke="var(--color-vault-line)" strokeWidth={1} shapeRendering="crispEdges">
        {lines}
      </g>
      <g fill="#4e4840">
        {sq.map(([cx, cy]) => (
          <rect key={`${cx}-${cy}`} x={cx * q - 4} y={cy * q - 4} width={8} height={8} />
        ))}
      </g>
    </g>
  )
}

/** Flat lock silhouette behind the dots so the grid disappears inside the shape. */
function Silhouette() {
  const P = PITCH
  const mid = (SH.R + SH.r) / 2
  const w = SH.R - SH.r
  return (
    <g fill="var(--color-vault)">
      <rect x={BODY.x0 * P - 2} y={BODY.y0 * P - 2} width={(BODY.x1 - BODY.x0) * P + 4} height={(BODY.y1 - BODY.y0) * P + 2} />
      <path
        d={`M ${(SH.cx - mid) * P} ${SH.legBottom * P} V ${SH.cy * P} A ${mid * P} ${mid * P} 0 0 1 ${(SH.cx + mid) * P} ${SH.cy * P} V ${SH.legBottom * P}`}
        fill="none"
        stroke="var(--color-vault)"
        strokeWidth={w * P + 6}
      />
    </g>
  )
}

export type SealTone = 'idle' | 'ok' | 'bad' | 'unknown'

export function VaultSeal({
  tone = 'idle',
  grid = true,
  boost = 1,
  className = '',
  title,
}: {
  tone?: SealTone
  grid?: boolean
  /** Dot radius multiplier for small renders (keeps the seal legible under ~140px). */
  boost?: number
  className?: string
  /** When set, the seal is announced with this text; otherwise it is decorative. */
  title?: string
}) {
  const dots = sealDots()
  return (
    <svg
      viewBox={`0 0 ${BOARD} ${BOARD}`}
      className={`seal block h-auto w-full ${className}`}
      data-tone={tone}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {grid ? <Board /> : null}
      <Silhouette />
      <g>
        {dots.map((d, k) => {
          const cls = d.g >= 0 ? `${d.cls} dg g${d.g}` : d.cls
          const style =
            d.cls === 'di'
              ? ({ '--d': d.d, '--c': d.c } as CSSProperties)
              : d.cls === 'd1'
                ? ({ '--c': d.c } as CSSProperties)
                : undefined
          if (d.sq) {
            const s = d.r * 2 * boost
            return (
              <rect
                key={k}
                className={cls}
                style={style}
                x={f1(d.x * PITCH - s / 2)}
                y={f1(d.y * PITCH - s / 2)}
                width={f1(s + (d.sq - 1) * PITCH)}
                height={f1(s)}
                rx={0.9}
              />
            )
          }
          return <circle key={k} className={cls} style={style} cx={f1(d.x * PITCH)} cy={f1(d.y * PITCH)} r={f1(d.r * boost)} />
        })}
      </g>
    </svg>
  )
}
