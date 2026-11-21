'use client'

import { useEffect, useRef, type CSSProperties } from 'react'
import { OUTLINE_PATHS, OUTLINE_VIEWBOX } from '@/lib/motion/saksiOutline'
import { createWitnessSeal, type WitnessSeal } from '@/lib/motion/witnessSeal'

const DRAW_MS = 1200 + OUTLINE_PATHS.length * 55 + 120

/**
 * Footer "Witness Seal" (riset-ui/09 §1.2): the Saksi mark + wordmark in hairline. On enter the
 * outline draws left to right; once settled, a canvas overlay witnesses the cursor path as a chain of
 * dots along the letter edges and re-seals it with an ice pulse + blue block stamp (hash label).
 * Reduced motion / no JS: static outline only.
 */
export function WitnessSealArt() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const labelRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const wrap = wrapRef.current
    const svg = svgRef.current
    const canvas = canvasRef.current
    const label = labelRef.current
    if (!wrap || !svg || !canvas || !label) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches
    let engine: WitnessSeal | null = null
    let inView = false
    let settleTimer = 0

    const io = new IntersectionObserver(
      ([e]) => {
        inView = e.isIntersecting
        if (inView && !wrap.hasAttribute('data-drawn')) {
          wrap.setAttribute('data-drawn', '')
          if (!reduced) {
            settleTimer = window.setTimeout(() => {
              wrap.setAttribute('data-settled', '')
              engine = createWitnessSeal({ wrap, svg, canvas, label, interactive: fine })
              engine?.setInView(inView)
            }, DRAW_MS)
          }
        }
        engine?.setInView(inView)
      },
      { threshold: 0.1 },
    )
    io.observe(wrap)
    return () => {
      io.disconnect()
      clearTimeout(settleTimer)
      engine?.destroy()
    }
  }, [])

  return (
    <div
      ref={wrapRef}
      className="ws-art relative w-full select-none text-dot"
      style={{ aspectRatio: `${OUTLINE_VIEWBOX.w} / ${OUTLINE_VIEWBOX.h}` }}
      aria-hidden="true"
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${OUTLINE_VIEWBOX.w} ${OUTLINE_VIEWBOX.h}`}
        className="absolute inset-0 h-full w-full overflow-visible"
        fill="none"
        stroke="currentColor"
        strokeWidth={1}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {OUTLINE_PATHS.map((d, i) => (
          <path key={i} d={d} pathLength={1} vectorEffect="non-scaling-stroke" style={{ '--i': i } as CSSProperties} />
        ))}
      </svg>
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
      <span
        ref={labelRef}
        className="ws-label absolute whitespace-nowrap rounded-sm bg-vault/80 px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-[.08em] text-dot-2"
      />
    </div>
  )
}
