import { N, PALETTES, type Surface } from '@/components/landing/lattice/core'
import { namedShape, type ShapeName } from '@/components/landing/lattice/shapes'

// Same geometry as the landing's canvas renderer (renderer.ts): radius = pitch × .107 × size step,
// sub-step dots skipped. Drawn as SVG so the object is in the first paint (SSR, print, screenshots)
// instead of waiting for the canvas IntersectionObserver.
const R_PER_STEP = 0.107
const MIN_S = 0.7

/** Static dot-matrix object: one lattice shape, no morph. For in-app moments where the object must always be there. */
export function LatticeStatic({
  shape,
  param,
  title,
  surface = 'vault',
  className = '',
}: {
  shape: ShapeName
  param?: number
  title: string
  surface?: Surface
  className?: string
}) {
  const f = namedShape(shape, param)
  const pal = PALETTES[surface]
  const dots: { x: number; y: number; r: number; fill: string }[] = []
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const k = j * N + i
      const s = f.s[k]
      if (s < MIN_S) continue
      const [r, g, b] = pal[f.c[k]]
      dots.push({ x: i + 0.5, y: j + 0.5, r: R_PER_STEP * s, fill: `rgb(${r},${g},${b})` })
    }
  return (
    <svg viewBox={`0 0 ${N} ${N}`} role="img" aria-label={title} className={`block aspect-square w-full ${className}`}>
      <title>{title}</title>
      {dots.map((d) => (
        <circle key={`${d.x}-${d.y}`} cx={d.x} cy={d.y} r={d.r} fill={d.fill} />
      ))}
    </svg>
  )
}
