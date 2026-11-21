'use client'

import { useEffect, useRef, type CSSProperties } from 'react'
import { Cite } from '@/components/ui/Cite'
import { matches, PIN_QUERY, progress, pin, range, REDUCED_QUERY, subscribe } from '@/lib/motion/scroll'
import type { SourceId } from '@/lib/sources'

const STATEMENT: { t: string; tone: 'mute' | 'ink'; cite?: readonly SourceId[] }[] = [
  { t: 'Your access log lives in the company’s own database.', tone: 'mute', cite: ['uu-pdp-31', 'djp-npwp-2024'] },
  { t: 'Any insider can edit a row.', tone: 'ink' },
  { t: 'You would never know.', tone: 'mute' },
]
const N_WORDS = STATEMENT.reduce((n, s) => n + s.t.split(' ').length, 0)

// Real-world receipts for the statement above (lib/sources.ts), printed under the till roll.
const EVIDENCE: { k: string; v: string; cite: readonly SourceId[] }[] = [
  { k: 'Dark web · 2024', v: '56,128,160 records exposed', cite: ['bssn-dark-web-2024'] },
  { k: 'Tax office · 2024', v: 'Denied a leak with own logs', cite: ['djp-npwp-2024'] },
]

const BEFORE = 'SHARED WITH THIRD PARTY'
const AFTER = 'READ'

type Row = { k: string; v: string; dim?: boolean; did?: boolean }
const ROWS: Row[] = [
  { k: '21 NOV 09:12 · R.0408', v: 'READ · OPS-12', dim: true },
  { k: '21 NOV 10:47 · R.0409', v: 'UPDATE · OPS-03', dim: true },
  { k: '21 NOV 11:30 · R.0410', v: 'READ · CS-07', dim: true },
  { k: '21 NOV 13:58 · R.0411', v: 'EXPORT · RISK-02', dim: true },
  { k: '21 NOV 14:03 · R.0412', v: 'OPENED YOUR FILE' },
  { k: 'WHO', v: 'Contoh Lending Co.' },
  { k: 'DID', v: AFTER, did: true },
  { k: 'WHY', v: 'Debt collection' },
  { k: 'BASIS', v: 'Legitimate interest' },
  { k: 'FINGERPRINT', v: 'none · database only' },
]

/**
 * S2 problem as one typographic moment (15 S2 + 17 C.3), pinned on desktop:
 *  p 0–.55  the statement scrubs in word by word (faint → its final tone)
 *  p .04–.6 the access log prints upward like a till roll; the newest row is inverted
 *  p .66–.86 the DID value backspaces "SHARED WITH THIRD PARTY" and types "READ" — the cover-up, live
 *  p .9    "Nobody but the insider saw that."
 * Mobile: no pin; words scrub on element progress, the rewrite plays once on view (28 ms/char).
 * No JS / reduced motion: the final state, with the old value shown struck through.
 */
export function ProblemMoment() {
  const trackRef = useRef<HTMLElement>(null)
  const textRef = useRef<HTMLParagraphElement>(null)
  const rollRef = useRef<HTMLDivElement>(null)
  const typedRef = useRef<HTMLSpanElement>(null)
  const caretRef = useRef<HTMLSpanElement>(null)
  const coverRef = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    const track = trackRef.current
    const text = textRef.current
    const roll = rollRef.current
    const typed = typedRef.current
    const caret = caretRef.current
    const cover = coverRef.current
    if (!track || !text || !roll || !typed || !caret || !cover) return
    if (matches(REDUCED_QUERY)) return
    track.setAttribute('data-live', '')
    const rows = Array.from(roll.querySelectorAll<HTMLElement>('[data-row]'))
    let newest = -1
    let shown = ''

    const write = (r: number) => {
      // r: 0 → 1 across backspace then type
      const s = r < 0.5 ? BEFORE.slice(0, Math.round(BEFORE.length * (1 - r * 2))) : AFTER.slice(0, Math.round(AFTER.length * (r * 2 - 1)))
      if (s !== shown) typed.textContent = shown = s
      const on = r > 0 && r < 1
      caret.style.opacity = on ? '1' : '0'
      const row = caret.closest('[data-row]')
      if (on) row?.setAttribute('data-edit', '')
      else row?.removeAttribute('data-edit')
    }

    const setNewest = (q: number) => {
      const n = Math.max(0, Math.min(rows.length, Math.floor(q * rows.length + 0.001))) - 1
      if (n === newest) return
      rows[newest]?.removeAttribute('data-new')
      rows[n]?.setAttribute('data-new', '')
      newest = n
    }

    // mobile: rewrite once on view, time-based at 28 ms per character
    let played = false
    let timer = 0
    const playOnce = () => {
      if (played) return
      played = true
      const total = (BEFORE.length + AFTER.length) * 28 + 240
      const t0 = performance.now()
      const step = (now: number) => {
        const r = Math.min(1, (now - t0) / total)
        write(r)
        if (r < 1) timer = requestAnimationFrame(step)
        else cover.style.opacity = '1'
      }
      timer = requestAnimationFrame(step)
    }

    write(0)
    const unsub = subscribe(() => {
      if (matches(PIN_QUERY)) {
        const p = pin(track)
        text.style.setProperty('--wp', String(range(0, 0.55, p)))
        const q = Math.max(2 / rows.length, range(0.04, 0.6, p))
        roll.style.setProperty('--q', String(q))
        setNewest(q)
        write(range(0.66, 0.86, p))
        const c = range(0.88, 0.96, p)
        cover.style.opacity = String(c)
        cover.style.filter = `blur(${(1 - c) * 8}px)`
      } else {
        text.style.setProperty('--wp', String(range(0.18, 0.62, progress(text))))
        roll.style.setProperty('--q', '1')
        setNewest(1)
        if (!played) {
          cover.style.opacity = '0'
          const r = roll.getBoundingClientRect()
          if (r.top < window.innerHeight * 0.6) playOnce()
        }
      }
    })
    return () => {
      unsub()
      cancelAnimationFrame(timer)
    }
  }, [])

  let wi = 0
  return (
    <section ref={trackRef} aria-labelledby="problem-title" className="pm-track relative">
      <div className="pm-stage">
        <div className="frame grid items-center gap-14 px-3 py-20 md:px-8 lg:grid-cols-12 lg:gap-6 lg:py-0">
          <h2 id="problem-title" className="sr-only">
            The problem
          </h2>
          <p
            ref={textRef}
            className="pm-text text-[34px] font-medium leading-[1.04] tracking-[-0.03em] sm:text-[48px] lg:col-span-7 lg:text-[clamp(48px,5.2vw,80px)]"
            style={{ '--n': N_WORDS } as CSSProperties}
          >
            {STATEMENT.map((s, si) => (
              <span key={si} className={s.tone === 'ink' ? 'pm-ink' : 'pm-mute'}>
                {si ? ' ' : null}
                {s.t.split(' ').map((w, k) => (
                  <span key={k}>
                    {k ? ' ' : null}
                    <span className="pm-w" style={{ '--i': wi++ } as CSSProperties}>
                      {w}
                    </span>
                  </span>
                ))}
                {s.cite ? <Cite ids={s.cite} /> : null}
              </span>
            ))}
          </p>

          <div className="lg:col-span-5 lg:col-start-8">
            <div className="font-mono text-[12px] uppercase leading-[1.75] tracking-[0.02em] text-ink sm:text-[13px] xl:text-[14px]">
              <div className="pm-window relative overflow-hidden">
                <div ref={rollRef} className="pm-roll pb-2">
                  <div className="mb-2 flex justify-between border-b border-dashed border-line-strong pb-2 text-ink-2">
                    <span>Access log · Contoh Lending Co.</span>
                    <span>DB only</span>
                  </div>
                  <dl>
                    {ROWS.map((r) => (
                      <div
                        key={r.k}
                        data-row=""
                        className={`pm-row -mx-2 flex items-baseline rounded-[6px] px-2 ${r.dim ? 'text-ink-3' : ''}`}
                      >
                        <dt className="shrink-0">{r.k}</dt>
                        <span aria-hidden="true" className="leader" />
                        <dd className="shrink-0 text-right">
                          {r.did ? (
                            <span className="relative inline-grid text-left">
                              <span className="invisible col-start-1 row-start-1">{BEFORE}</span>
                              <span className="col-start-1 row-start-1">
                                <span ref={typedRef}>{AFTER}</span>
                                <span ref={caretRef} aria-hidden="true" className="pm-caret ml-px inline-block h-[1.05em] w-[2px] translate-y-[.15em] bg-current opacity-0" />
                              </span>
                            </span>
                          ) : (
                            r.v
                          )}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <p className="pm-was flex items-baseline text-ink-3">
                    <span>WAS</span>
                    <span aria-hidden="true" className="leader" />
                    <s>{BEFORE}</s>
                  </p>
                </div>
              </div>
              <div className="border-t border-dashed border-line-strong pt-3">
                <p ref={coverRef} className="pm-cover normal-case tracking-normal text-ink">
                  Nobody but the insider saw that.
                </p>
                <dl className="mt-4 text-[11px] text-ink-2 sm:text-[12px]">
                  {EVIDENCE.map((e) => (
                    <div key={e.k} className="flex items-baseline">
                      <dt className="min-w-0">{e.k}</dt>
                      <span aria-hidden="true" className="leader" />
                      <dd className="shrink-0 text-right">
                        {e.v}
                        <Cite ids={e.cite} />
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
