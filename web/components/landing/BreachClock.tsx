'use client'

import { useEffect, useRef, type CSSProperties } from 'react'
import { Cite } from '@/components/ui/Cite'
import { IconCheck } from '@/components/ui/icons'
import { matches, PIN_QUERY, pin, range, REDUCED_QUERY, subscribe } from '@/lib/motion/scroll'
import { Heading } from './Words'

const DEADLINE_H = 72
const SEALED_AT_H = 53.5 // the example notice is sealed 53.5 h after discovery → 18:30:00 left
const SCALE_H = 100 // ruler runs to 100 h so "late" has somewhere to go
const LATE_AT_H = 100

// digit columns: place value in seconds and modulus (H H : M M : S S)
const DIGITS = [
  [36000, 10],
  [3600, 10],
  [600, 6],
  [60, 10],
  [10, 6],
  [1, 10],
] as const

const pct = (h: number) => `${(h / SCALE_H) * 100}%`
const ROW = 1.25 // odometer row height in em (matches .bc-digits --row): room above/below each Doto glyph

/** Odometer position: a digit rolls only during the last 12% of its own cycle, like a real counter. */
function digitPos(sec: number, place: number, mod: number) {
  const v = sec / place
  const base = Math.floor(v)
  const frac = v - base
  return (base % mod) + Math.max(0, (frac - 0.88) / 0.12)
}

function finalSec() {
  return Math.round((DEADLINE_H - SEALED_AT_H) * 3600)
}

/**
 * S5 — the 72-hour countdown moment (15 S5, 16 C.2 S5), pinned on desktop:
 *  p 0–.75  Doto 72:00:00 rolls DOWN to 18:30:00 (never counts up); the marker walks the ruler to 53.5 H
 *  p .75    NOTIFIED drops at the marker; ON TIME · 18.5 H TO SPARE stamps in
 *  p .88–1  a 30% ghost path runs past the 72 H deadline to LATE BY 28 H — both outcomes computed
 * Mobile: no pin, the same timeline plays once on view over 2.2 s. No JS / reduced motion: final state.
 */
export function BreachClock() {
  const trackRef = useRef<HTMLElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const colsRef = useRef<(HTMLSpanElement | null)[]>([])

  useEffect(() => {
    const track = trackRef.current
    const root = rootRef.current
    if (!track || !root || matches(REDUCED_QUERY)) return
    track.setAttribute('data-live', '')
    const cols = colsRef.current
    const apply = (p: number) => {
      const e = range(0, 0.75, p)
      const left = Math.round((DEADLINE_H - SEALED_AT_H * e) * 3600)
      DIGITS.forEach(([place, mod], i) => {
        const el = cols[i]
        if (el) el.style.transform = `translateY(${-digitPos(left, place, mod) * ROW}em)`
      })
      root.style.setProperty('--e', String(e))
      root.style.setProperty('--n', String(range(0.75, 0.8, p)))
      root.style.setProperty('--v', String(range(0.78, 0.86, p)))
      root.style.setProperty('--g', String(range(0.88, 1, p)))
    }
    apply(0)

    let played = false
    let raf = 0
    const unsub = subscribe(() => {
      if (matches(PIN_QUERY)) {
        played = false
        apply(pin(track))
        return
      }
      if (played) return
      const r = root.getBoundingClientRect()
      if (r.top > window.innerHeight * 0.7) {
        apply(0)
        return
      }
      played = true
      const t0 = performance.now()
      const step = (now: number) => {
        const p = Math.min(1, (now - t0) / 2200)
        apply(p)
        if (p < 1) raf = requestAnimationFrame(step)
      }
      raf = requestAnimationFrame(step)
    })
    return () => {
      unsub()
      cancelAnimationFrame(raf)
    }
  }, [])

  const fin = finalSec()
  return (
    <section ref={trackRef} id="breach" aria-labelledby="breach-title" className="bc-track relative scroll-mt-0">
      <div className="bc-stage">
        <div ref={rootRef} className="bc frame px-3 py-16 md:px-8 lg:py-0">
          <div className="grid gap-6 lg:grid-cols-12 lg:items-end">
            <Heading
              id="breach-title"
              lead="A breach starts a clock."
              tail="The chain keeps the time."
              className="text-[32px] leading-[1.06] md:text-[48px] lg:col-span-7"
            />
            <p className="max-w-[44ch] text-[16px] leading-[1.6] tracking-[0.01em] text-ink-2 md:text-[18px] lg:col-span-4 lg:col-start-9">
              UU PDP Art. 46 gives a company 72 hours to report a breach.<Cite ids={['uu-pdp-46']} /> The notice is sealed with its own block time,
              and the contract compares it with the declared discovery time.
            </p>
          </div>

          <div className="mt-12 md:mt-16">
            <p
              role="img"
              aria-label="18 hours 30 minutes left of the 72-hour window"
              className="bc-digits flex items-center justify-center text-ink"
            >
              {DIGITS.map(([place, mod], i) => (
                <span key={i} className="contents">
                  {i === 2 || i === 4 ? <span className="bc-sep" aria-hidden="true"><i /><i /></span> : null}
                  <span className="bc-cell doto" aria-hidden="true">
                    <span
                      ref={(el) => {
                        colsRef.current[i] = el
                      }}
                      className="bc-col"
                      style={{ transform: `translateY(${-digitPos(fin, place, mod) * ROW}em)` }}
                    >
                      {Array.from({ length: mod + 1 }, (_, k) => (
                        <span key={k}>{k % mod}</span>
                      ))}
                    </span>
                  </span>
                </span>
              ))}
            </p>
            <div className="label mt-6 flex flex-wrap justify-between gap-2 text-[12px] text-ink-2 md:mt-8">
              <span>Left of the 72-hour window</span>
              <span>Example notice · synthetic data</span>
            </div>
          </div>

          {/* ruler: 0–100 h, hairline ticks every 6 h, deadline at 72 h */}
          <div className="relative mt-10 h-28 sm:h-24 md:mt-14" aria-hidden="true">
            <div className="absolute inset-x-0 top-8 h-px bg-line-strong" />
            <div className="bc-late absolute top-[26px] h-[13px]" style={{ left: pct(DEADLINE_H), right: 0 }} />
            {Array.from({ length: 17 }, (_, k) => k * 6).map((h) => (
              <span key={h} className="absolute top-[26px] h-[7px] w-px bg-line-strong" style={{ left: pct(h) }} />
            ))}
            {[0, 24, 48, 72].map((h) => (
              <span
                key={h}
                className={`label absolute top-0 whitespace-nowrap text-[11px] ${h ? '-translate-x-1/2' : ''} ${h === 72 ? 'text-ink' : 'text-ink-3'}`}
                style={{ left: pct(h) }}
              >
                {h} H{h === 72 ? <span className="hidden sm:inline"> · deadline</span> : null}
              </span>
            ))}
            <span className="absolute top-5 h-[25px] w-px bg-ink" style={{ left: pct(DEADLINE_H) }} />
            <span className="label absolute right-0 top-0 hidden text-[11px] text-ink-3 sm:block">100 H</span>

            <div className="bc-fill absolute left-0 top-[31.5px] h-[3px] rounded-full bg-ink" style={{ width: pct(SEALED_AT_H) }} />
            <div className="bc-ghost absolute top-8 h-px" style={{ left: pct(SEALED_AT_H), width: pct(LATE_AT_H - SEALED_AT_H) }} />
            <span className="bc-marker absolute top-[28px] size-[9px] -translate-x-1/2 rounded-full bg-ink" style={{ '--to': pct(SEALED_AT_H) } as CSSProperties} />
            <span className="bc-notified absolute top-10 flex -translate-x-1/2 flex-col items-center" style={{ left: pct(SEALED_AT_H) }}>
              <span className="h-4 w-px bg-ink" />
              <span className="label mt-1 whitespace-nowrap text-[11px] text-ink">Notified · 53.5 H</span>
            </span>
            <span className="bc-lateby label absolute right-0 top-[84px] whitespace-nowrap sm:top-12 text-[11px] text-bad">If sealed at 100 H · late by 28 H</span>
          </div>

          <p className="bc-verdict mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-[18px] font-medium text-ok md:text-[22px]">
            <span className="flex size-7 items-center justify-center rounded-sm bg-ok text-white">
              <IconCheck size={16} strokeWidth={2.6} />
            </span>
            <span className="whitespace-nowrap">On time</span>
            <span className="label basis-full text-[12px] text-ink-2 sm:basis-auto">Sealed at 53.5 H of 72 H · 18.5 H to spare · computed by the contract</span>
          </p>
        </div>
      </div>
    </section>
  )
}
