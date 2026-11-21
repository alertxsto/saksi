'use client'

import { useEffect, useRef } from 'react'
import { DotoValue } from '@/components/ui/DotoValue'
import { IconCheck, IconX } from '@/components/ui/icons'
import { scramble } from '@/lib/motion/scramble'
import { matches, range, REDUCED_QUERY, subscribe } from '@/lib/motion/scroll'
import { Cta } from './Cta'
import { Heading } from './Words'

const PROVES = [
  'The record has not been changed since it was sealed.',
  'When the chain received it: the chain clock, not the company’s.',
  'Which registered company wallet sealed it.',
  'Whether a breach notice was sealed inside 72 hours.',
]
const DOES_NOT_PROVE = [
  'That every access was recorded, only the ones logged.',
  'That the access was lawful or the stated reason is true.',
  'The real discovery time of a breach.',
  'That notifications were actually sent to people.',
]
const FP = '0x3fa2c41b7e0d…5b1e09e19c1d'
const N = 14
const C = (N - 1) / 2

// 14×14 lattice shapes on paper (size 0..1; 0 = no dot, there is no background matrix)
function receipt(i: number, j: number) {
  if (i < 3 || i > 10 || j < 1 || j > 12) return 0
  if (j === 12) return i % 2 ? 1 : 0 // torn edge
  if (i === 3 || i === 10 || j === 1) return 1
  if ((j === 3 && i < 9) || (j === 5 && i < 8) || (j === 7 && i < 9) || (j === 9 && i < 7)) return i > 4 ? 0.62 : 0
  return 0
}
function seg(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax
  const dy = by - ay
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(px - ax - t * dx, py - ay - t * dy)
}
function check(i: number, j: number) {
  const d = Math.min(seg(i, j, 2.5, 7, 5.5, 10), seg(i, j, 5.5, 10, 11.2, 3.6))
  return d < 0.75 ? 1 : d < 1.35 ? 0.62 : 0
}
const CELLS = Array.from({ length: N * N }, (_, k) => {
  const i = k % N
  const j = (k / N) | 0
  return { i, j, a: receipt(i, j), b: check(i, j), d: (Math.hypot(i - C, j - C) / Math.hypot(C, C)) * 0.6 }
})
const INK = '#1E1A16'
const OK = '#157F3D'
const fillFor = (s: number, ok: boolean) => (ok ? OK : INK)

/**
 * S7 "Don't trust us. Check it yourself." (15 S7 / #9): the page's one boxed object is a real input row.
 * At 55% visibility it auto-demos: the fingerprint scrambles in, Verify presses, the 14×14 lattice morphs
 * receipt → check with a green radial sweep, and the result + DotoValue timer appear. Below, the limits
 * as two hairline lists whose rows turn ink-3 → ink as they cross the viewport.
 */
export function Verifier() {
  const boxRef = useRef<HTMLDivElement>(null)
  const fpRef = useRef<HTMLElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const limitsRef = useRef<HTMLDivElement>(null)
  const runRef = useRef<() => void>(() => {})

  useEffect(() => {
    const box = boxRef.current
    const fp = fpRef.current
    const svg = svgRef.current
    const limits = limitsRef.current
    if (!box || !fp || !svg || !limits || matches(REDUCED_QUERY)) return
    const dots = Array.from(svg.querySelectorAll<SVGCircleElement>('circle'))
    const timers: number[] = []
    const setPhase = (v: 'idle' | 'press' | 'done') => box.setAttribute('data-phase', v)
    let raf = 0
    let stopScr: (() => void) | null = null

    const paint = (m: number) => {
      CELLS.forEach((c, k) => {
        const t = Math.max(0, Math.min(1, (m - c.d) / 0.4))
        const e = 1 - (1 - t) ** 3
        const s = c.a + (c.b - c.a) * e
        dots[k].setAttribute('r', (0.44 * s).toFixed(3))
        dots[k].setAttribute('fill', fillFor(s, t > 0.5))
      })
    }
    const run = () => {
      timers.forEach(clearTimeout)
      cancelAnimationFrame(raf)
      stopScr?.()
      paint(0)
      setPhase('idle')
      stopScr = scramble(fp, FP, { stepMs: 26 })
      timers.push(
        window.setTimeout(() => setPhase('press'), 1000),
        window.setTimeout(() => {
          const t0 = performance.now()
          const step = (now: number) => {
            const m = Math.min(1, (now - t0) / 900)
            paint(m)
            if (m < 1) raf = requestAnimationFrame(step)
            else setPhase('done')
          }
          raf = requestAnimationFrame(step)
        }, 1180),
      )
    }
    runRef.current = run
    paint(0)
    setPhase('idle')

    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          io.disconnect()
          run()
        }
      },
      { threshold: 0.55 },
    )
    io.observe(box)

    limits.setAttribute('data-live', '')
    const rows = Array.from(limits.querySelectorAll<HTMLElement>('li'))
    const unsub = subscribe(() => {
      const vh = window.innerHeight
      for (const r of rows) r.style.setProperty('--q', range(vh * 0.82, vh * 0.58, r.getBoundingClientRect().top).toFixed(3))
    })
    return () => {
      io.disconnect()
      unsub()
      timers.forEach(clearTimeout)
      cancelAnimationFrame(raf)
      stopScr?.()
    }
  }, [])

  return (
    <section id="verify" aria-labelledby="verify-title" className="relative scroll-mt-24 border-t border-line py-16 md:py-[104px]">
      <div className="frame px-3 md:px-8">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-6">
          <div className="lg:col-span-5">
            <Heading id="verify-title" lead="Don’t trust us." tail="Check it yourself." className="text-[34px] leading-[1.04] md:text-[56px]" />
            <p className="mt-6 max-w-[44ch] text-[16px] leading-[1.6] tracking-[0.01em] text-ink-2 md:text-[18px]">
              Paste a fingerprint or a transaction, or scan a receipt QR. Your browser reads the chain from a public node
              and recomputes the fingerprint itself. Switch the node, read the raw log, open it on the block explorer.
            </p>
            <div className="mt-8">
              <Cta href="/proof">Open the public verifier</Cta>
            </div>
          </div>

          <div ref={boxRef} className="lg:col-span-6 lg:col-start-7 lg:pt-2" data-phase="done">
            <div className="ver-input flex h-16 items-center gap-3 rounded-md border border-line-strong bg-card pl-4 pr-2 transition-transform duration-300 ease-[cubic-bezier(.22,1,.36,1)] hover:scale-[1.01]">
              <span className="label hidden text-[11px] text-ink-3 sm:inline">Fingerprint</span>
              <code ref={fpRef} className="min-w-0 flex-1 truncate font-mono text-[14px] text-ink">
                {FP}
              </code>
              <span
                aria-hidden="true"
                className="ver-btn flex h-12 items-center rounded-sm bg-ink px-4 text-[14px] font-medium text-paper transition-[transform,background-color] duration-150"
              >
                Verify
              </span>
            </div>

            <div className="mt-8 flex items-center gap-6 md:gap-8">
              <svg ref={svgRef} viewBox={`0 0 ${N} ${N}`} className="size-[132px] shrink-0 md:size-[168px]" aria-hidden="true">
                {CELLS.map((c, k) => (
                  <circle key={k} cx={c.i + 0.5} cy={c.j + 0.5} r={(0.44 * c.b).toFixed(3)} fill={fillFor(c.b, true)} />
                ))}
              </svg>
              <div className="ver-result min-w-0" aria-live="polite">
                <p className="flex items-center gap-2 text-[20px] font-medium text-ok md:text-[24px]">
                  <IconCheck size={20} strokeWidth={2.6} /> Match
                </p>
                <p className="mt-1 text-[15px] text-ink-2">This record matches the chain.</p>
                <p className="mt-4 text-[48px] leading-none text-ink">
                  <DotoValue value="1.8" unit="s" />
                </p>
                <p className="label mt-3 text-[11px] text-ink-2">Verified by your phone · not by our server</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => runRef.current()}
              className="label mt-6 min-h-11 text-[12px] text-ink-2 underline decoration-dashed underline-offset-4 transition-colors duration-150 hover:text-blue"
            >
              Run the check again
            </button>
          </div>
        </div>

        <div ref={limitsRef} className="limits mt-10 grid gap-10 md:mt-24 md:grid-cols-2 md:gap-6">
          {[
            { h: 'Saksi proves', items: PROVES, ok: true },
            { h: 'Saksi does not prove', items: DOES_NOT_PROVE, ok: false },
          ].map((col) => (
            <div key={col.h}>
              <h3 className="text-[20px] font-medium tracking-[-0.02em] text-ink md:text-[24px]">{col.h}</h3>
              <ul className="mt-4 border-b border-line">
                {col.items.map((t) => (
                  <li key={t} className="limit-row flex gap-3 border-t border-line py-3.5 text-[16px] leading-snug">
                    {col.ok ? (
                      <IconCheck size={16} strokeWidth={2.4} className="mt-0.5 shrink-0 text-ok" />
                    ) : (
                      <IconX size={16} strokeWidth={2.4} className="mt-0.5 shrink-0 text-ink-3" />
                    )}
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
