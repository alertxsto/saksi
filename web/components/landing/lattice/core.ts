// Lattice core: the shared 40×40 dot grid, colour ids, palettes and small math helpers.
// Every shape lives on this one grid, so a morph is a per-cell interpolation (riset-ui/15 §3 #1).

export const N = 40
export const CELLS = N * N
export const MID = N / 2

/** Colour ids stored per cell; palettes map them to RGB per surface. */
export const C = { EMPTY: 0, DOT: 1, DOT2: 2, ICE: 3, OK: 4, BAD: 5, INK: 6 } as const
export type ColorId = (typeof C)[keyof typeof C]

export type RGB = readonly [number, number, number]
export type Palette = readonly RGB[]
export type Surface = 'vault' | 'paper'

const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]

// riset-ui/05 §2 + 15 §2.2. Vault: dot / dot-2 / ice / verdict-only ok-v & bad-v / vault-ink.
// Paper: line (empty), ink-3, ink, blue terminals, light semantic fg.
export const PALETTES: Record<Surface, Palette> = {
  vault: ['#4A443C', '#6E6457', '#8A7F70', '#9BD9E0', '#5BCB8A', '#FF5A4D', '#EDE9E1'].map(hex),
  paper: ['#D9D4C9', '#9A9288', '#1E1A16', '#2A2AE8', '#157F3D', '#C8281E', '#1E1A16'].map(hex),
}

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const easeOutCubic = (t: number) => 1 - (1 - t) ** 3
export const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t))
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
/** easeOutBack: about a 10% overshoot, used for the chain shift's 1-cell overshoot. */
export const easeOutBack = (t: number) => {
  const c1 = 1.70158
  return 1 + (c1 + 1) * (t - 1) ** 3 + c1 * (t - 1) ** 2
}
/** Progress of `v` through the window [a, b], clamped. */
export const win = (v: number, a: number, b: number) => clamp01((v - a) / (b - a))

/** Deterministic 0..1 hash per cell (same on server and client). */
export function hash(i: number, j: number, k = 0): number {
  let h = Math.imul(i * 374761393 + j * 668265263 + k * 2147483647, 1274126177)
  h = Math.imul(h ^ (h >>> 13), 1103515245)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

export function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax
  const dy = by - ay
  const t = clamp01(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

/** Signed distance to a rounded box centred at (cx, cy) with half sizes (hx, hy) and radius r. */
export function boxDist(px: number, py: number, cx: number, cy: number, hx: number, hy: number, r: number) {
  const qx = Math.abs(px - cx) - (hx - r)
  const qy = Math.abs(py - cy) - (hy - r)
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r
}
