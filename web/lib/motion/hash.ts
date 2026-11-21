// Server-safe (no React import): used by server components such as OdoText.
/** Tiny deterministic hash in [0,1) — same on server and client, so seeded markup never mismatches. */
export function hash01(a: number, b = 0): number {
  let h = (a * 374761393 + b * 668265263) | 0
  h = (h ^ (h >>> 13)) * 1274126177
  h ^= h >>> 16
  return ((h >>> 0) % 100000) / 100000
}
