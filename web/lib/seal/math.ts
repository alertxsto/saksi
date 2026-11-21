// Small math helpers for the Vault Seal renderer (no deps).

export const DEG = Math.PI / 180

export function hexRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

export const mix3 = (a: number[], b: number[], t: number): [number, number, number] => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
]

export const easeOut = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3)

/** Frame-rate independent approach factor for exponential smoothing. */
export const approach = (dt: number, rate: number) => 1 - Math.exp(-dt * rate)

/**
 * Object -> world rotation R = Rx(pitch) · Ry(yaw), returned ROW-major. Uploaded to a GLSL mat3
 * (column-major) without transposing, the shader receives Rᵀ = world -> object.
 */
export function rotRows(yaw: number, pitch: number): Float32Array {
  const cy = Math.cos(yaw)
  const sy = Math.sin(yaw)
  const cp = Math.cos(pitch)
  const sp = Math.sin(pitch)
  return new Float32Array([cy, 0, sy, sp * sy, cp, -sp * cy, -cp * sy, sp, cp * cy])
}
