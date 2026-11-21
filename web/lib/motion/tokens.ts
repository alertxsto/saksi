// Shared motion tokens (riset-ui/09-motion-teardown.md §4). CSS mirrors live in app/globals.css
// (--ease-out-soft, --dur-swap-in …); use these when a value has to be set from JS.

export const EASE = {
  /** zaro cards / crossfades */
  outExpo: 'cubic-bezier(.16,1,.3,1)',
  /** ghost reveals */
  outSoft: 'cubic-bezier(.19,1,.22,1)',
  /** hovers */
  snap: 'cubic-bezier(.22,1,.36,1)',
  /** scanner steps */
  step: 'cubic-bezier(.7,0,.3,1)',
} as const

export const DUR = {
  hover: 150,
  swapIn: 480,
  swapOut: 320,
  reveal: 1200,
  media: 1800,
  stagger: 80,
  /** 01/02/03 cycle: label, request, checks */
  cycleStagger: [0, 220, 440] as const,
  cycle: 2800,
} as const

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
export const easeOutCubic = (t: number) => 1 - (1 - t) ** 3
export const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t))
export const smoothstep = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a))
  return t * t * (3 - 2 * t)
}

/** True when the user asked for reduced motion (safe on the server: false). */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
