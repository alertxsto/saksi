'use client'

// "The Witness" (riset-ui/18 §C, 15 actions 2 + 4): one dot-lattice object morphs through a single
// pinned shot, RECORD → SEAL → VERIFY → EDIT → ALTERED. Desktop: a 640vh wrapper with a sticky vault
// slab; every value is a pure function of scroll, so scrolling up un-types the insider edit and
// retracts the red. The scroll path never touches React state: one rAF writes canvas + inline styles.
// Mobile / short screens / reduced motion: no pin; beats stack and each morph plays once (or static).

import { type ReactNode, useEffect, useRef } from 'react'
import { clamp01, easeOutExpo, win } from './lattice/core'
import { createFrame } from './lattice/morph'
import { createLatticeRenderer, type LatticeRenderer } from './lattice/renderer'
import { BEATS, CALLOUTS, type CalloutDef, DID_BEFORE, didText, PIN_VH, scrambleText, storyFrame, storyFrameAtT, toT, type Tone } from './lattice/story'

export { LatticeObject } from './lattice/LatticeObject'

const PIN_MQ = '(min-width: 1024px) and (min-height: 620px) and (prefers-reduced-motion: no-preference)'
const SHOW_PIN = 'hidden [@media(min-width:1024px)_and_(min-height:620px)_and_(prefers-reduced-motion:no-preference)]:block'
const SHOW_STACK = '[@media(min-width:1024px)_and_(min-height:620px)_and_(prefers-reduced-motion:no-preference)]:hidden'

const H2_A = ['One record.', 'One fingerprint. Checked by you.'] as const
const H2_B = ['Edit the database.', 'The chain remembers.'] as const
const COPY = [
  { h: 'A company opens your file.', p: 'It has to write down who opened it, what they did and why.' },
  { h: 'Only a fingerprint goes on chain.', p: 'Your data stays on their server. The chain gets a hash, sealed by the company’s registered wallet.' },
  { h: 'Your phone recomputes it.', p: 'Same fingerprint as the chain. Match. Checked in your browser, not on our server.' },
  { h: 'An insider rewrites the log.', p: 'One field, quietly, straight in the database. Nobody touches the chain.' },
  { h: 'Your phone flags it.', p: 'The chain still holds the original fingerprint. The edited record no longer matches it.' },
] as const
const CHIPS = [
  { t: [0.86, 2.04] as const, items: ['Hash only on chain', 'No names · no ID numbers'] },
  { t: [2.5, 3.02] as const, items: ['Verified in your browser'] },
]
const LEDGER = [
  ['WHO', 'Contoh Lending Co.'],
  ['DID', DID_BEFORE],
  ['WHY', 'Debt collection'],
  ['BASIS', 'Legitimate interest'],
] as const

const TAG: Record<Tone, string> = { ice: 'bg-ice text-vault', ok: 'bg-ok-v text-vault', bad: 'bg-bad-v text-vault' }
const MARK: Record<Tone, string> = { ice: 'bg-ice', ok: 'bg-ok-v', bad: 'bg-bad-v' }

// ------------------------------------------------------------------------------------------------

export function StoryPin({ className = '' }: { className?: string }) {
  const rootRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const mq = window.matchMedia(PIN_MQ)
    let stop: (() => void) | null = null
    const start = () => {
      stop?.()
      stop = mq.matches ? runPinned(root) : runStacked(root, window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    }
    start()
    mq.addEventListener('change', start)
    return () => {
      mq.removeEventListener('change', start)
      stop?.()
    }
  }, [])

  return (
    <section ref={rootRef} aria-labelledby="story-h" className={`relative ${className}`}>
      <ol className="sr-only">
        {COPY.map((c, k) => (
          <li key={c.h}>
            {BEATS[k].word}: {c.h} {c.p}
          </li>
        ))}
      </ol>
      <Pinned />
      <Stacked />
    </section>
  )
}

// ---- desktop: the pinned film -------------------------------------------------------------------

function Pinned() {
  return (
    <div data-pin className={SHOW_PIN} style={{ height: `${100 + PIN_VH}vh` }}>
      <div className="sticky top-0 h-screen p-3 lg:p-6">
        <div data-slab className="vault grain relative h-full overflow-hidden rounded-xl bg-vault text-vault-ink">
          <div
            data-tint
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-0"
            style={{ background: 'radial-gradient(48% 62% at 63% 50%, rgba(255,90,77,.16), transparent 72%)' }}
          />

          {/* stage */}
          <div
            data-stage
            className="absolute left-[63%] top-1/2 aspect-square -translate-x-1/2 -translate-y-1/2"
            style={{ width: 'min(560px, calc(100vh - 230px), 36vw)' }}
          >
            <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-[-13%] right-[-13%]">
              {BEATS.map((b, k) => (
                <div key={b.id} data-word={k} className="absolute inset-0 flex items-center justify-center opacity-0">
                  <div
                    data-word-in
                    className={`flex justify-between font-extralight leading-none tracking-normal ${k === 4 ? 'text-bad-v/25' : 'text-[#3D3832]'}`}
                    style={{ width: '86%', fontSize: 'clamp(72px, 8.6vw, 132px)' }}
                  >
                    {b.word.split('').map((ch, i) => (
                      <span key={i}>{ch}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <canvas data-canvas aria-hidden="true" className="absolute inset-0 h-full w-full" />
            <div
              data-stamp
              aria-hidden="true"
              className="pointer-events-none absolute left-1/2 top-[79%] whitespace-nowrap rounded-lg border-[3px] border-bad-v px-5 py-1.5 font-mono text-[clamp(24px,2.7vw,40px)] font-bold tracking-[0.12em] text-bad-v opacity-0"
              style={{ background: 'rgba(36,33,29,.82)' }}
            >
              ALTERED
            </div>
            {/* progress: five hairline segments */}
            <div aria-hidden="true" className="absolute inset-x-0 top-[calc(100%+30px)] grid grid-cols-5 gap-2">
              {BEATS.map((b, k) => (
                <div key={b.id}>
                  <div className="h-[2px] overflow-hidden rounded-full bg-vault-line">
                    <div data-seg={k} className={`h-full origin-left ${k === 4 ? 'bg-bad-v' : 'bg-ice'}`} style={{ transform: 'scaleX(0)' }} />
                  </div>
                  <div data-seg-label={k} className="label mt-2 text-dot">
                    {b.word}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* blueprint callouts (DOM, crisp) */}
          <div data-callouts aria-hidden="true" className="pointer-events-none absolute inset-0">
            {CALLOUTS.map((c) => (
              <Callout key={c.id} c={c} />
            ))}
          </div>

          {/* copy column */}
          <div className="absolute left-[clamp(28px,5.2vw,88px)] top-[clamp(36px,9vh,104px)] w-[min(37vw,520px)]">
            <div className="grid">
              {[H2_A, H2_B].map((h, k) => (
                <h2
                  key={h[0]}
                  id={k === 0 ? 'story-h' : undefined}
                  data-h2={k}
                  className="display col-start-1 row-start-1 text-[clamp(34px,3.7vw,56px)] font-semibold"
                  style={k ? { opacity: 0 } : undefined}
                >
                  {h[0]}
                  <br />
                  <span className="text-vault-ink-2">{h[1]}</span>
                </h2>
              ))}
            </div>
            <div className="mt-[clamp(28px,6vh,64px)] grid">
              {COPY.map((c, k) => (
                <div key={c.h} data-copy={k} className="col-start-1 row-start-1" style={k ? { opacity: 0 } : undefined}>
                  <h3 className="text-[clamp(22px,2.1vw,30px)] font-medium leading-tight tracking-[-0.02em]">{c.h}</h3>
                  <p className="mt-3 max-w-[40ch] text-[16px] leading-normal text-vault-ink-2">{c.p}</p>
                </div>
              ))}
            </div>
            <div className="mt-8 grid">
              {CHIPS.map((g, k) => (
                <div key={k} data-chips={k} className="col-start-1 row-start-1 flex flex-wrap content-start gap-2 opacity-0">
                  {g.items.map((t) => (
                    <span key={t} className="label inline-flex h-7 items-center gap-2 rounded-pill border border-ice/70 px-3 text-ice">
                      <span className="size-1.5 rounded-full bg-ice" />
                      {t}
                    </span>
                  ))}
                </div>
              ))}
              <Split />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Callout({ c }: { c: CalloutDef }) {
  return (
    <div data-co={c.id} className="absolute left-0 top-0 opacity-0">
      <span className={`absolute left-[-3px] top-[-3px] size-[6px] rounded-[1px] ${MARK[c.tone]}`} />
      <span data-vlead className={`absolute left-[-0.5px] w-px opacity-70 ${MARK[c.tone]}`} />
      <span data-lead className={`absolute left-0 h-px origin-left opacity-70 ${MARK[c.tone]}`} />
      <div data-plate className="absolute top-0 flex h-8 -translate-y-1/2 items-stretch whitespace-nowrap">
        <span data-tag className={`label flex shrink-0 items-center rounded-l-sm px-3 font-semibold ${TAG[c.tone]}`}>
          {c.tag}
        </span>
        <span
          data-val
          className={`flex flex-1 items-center overflow-hidden rounded-r-sm border border-l-0 border-vault-line bg-vault-2 px-3 text-vault-ink ${c.dot ? 'doto text-[20px]' : 'font-mono text-[13px]'}`}
        >
          {c.value}
        </span>
      </div>
    </div>
  )
}

const IconX = () => (
  <svg viewBox="0 0 12 12" className="size-3" aria-hidden="true">
    <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
)
const IconCheck = () => (
  <svg viewBox="0 0 12 12" className="size-3" aria-hidden="true">
    <path d="M2.5 6.3l2.3 2.3 4.7-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
)

/**
 * Diff ledger (zaro-style): what the database says vs what the chain sealed. On ALTERED the DID row
 * becomes a full-width red band, the database value turns red with ×, the sealed value stays ice with ✓.
 * Desktop: two value columns. Mobile: the two lists stack.
 */
function Split({ mobile = false }: { mobile?: boolean }) {
  const value = (side: 'db' | 'chain', k: string, v: string) => {
    const did = k === 'DID'
    const mark = did ? (side === 'db' ? { 'data-mark-db': '' } : { 'data-mark-chain': '' }) : {}
    return (
      <span className="flex min-w-0 items-center gap-2">
        <span {...mark} className={`flex size-3 shrink-0 items-center justify-center opacity-0 ${side === 'db' ? 'text-bad-v' : 'text-ice'}`}>
          {did ? side === 'db' ? <IconX /> : <IconCheck /> : null}
        </span>
        {did && side === 'db' ? (
          <span className="flex min-w-0 items-center">
            <span data-did-db className="truncate">
              {v}
            </span>
            <span data-caret className="ml-px inline-block h-[15px] w-[2px] shrink-0 bg-ice opacity-0" />
          </span>
        ) : (
          <span {...(did ? { 'data-did-chain': '' } : {})} className="truncate">
            {v}
          </span>
        )}
      </span>
    )
  }
  const row = (k: string, cells: ReactNode, h: string) => (
    <div key={k} className={`relative col-span-full grid grid-cols-subgrid items-center ${h}`}>
      {k === 'DID' ? <span data-did-band className="absolute inset-y-0 -left-3 -right-3 rounded-md bg-bad-v/12 opacity-0" /> : null}
      <span className="label relative text-dot-2">{k}</span>
      {cells}
    </div>
  )
  const status = (
    <div className="relative mt-5 h-7">
      <span data-status="match" className="label absolute left-0 top-0 inline-flex h-7 items-center gap-2 rounded-pill border border-ok-v/70 px-3 text-ok-v">
        <span className="size-1.5 rounded-full bg-ok-v" />
        Match
      </span>
      <span
        data-status="altered"
        className="label absolute left-0 top-0 inline-flex h-7 items-center gap-2 whitespace-nowrap rounded-pill bg-bad-v px-3 font-semibold text-vault opacity-0"
      >
        <IconX />
        Altered · 1 field changed<span className="max-sm:hidden">&nbsp;after sealing</span>
      </span>
    </div>
  )
  const head = 'label relative pb-2 pl-5 text-vault-ink-2'
  if (mobile)
    return (
      <div data-split className="mt-6 font-mono text-[13px] leading-none text-vault-ink">
        {(['db', 'chain'] as const).map((side) => (
          <div key={side} className={`grid grid-cols-[56px_minmax(0,1fr)] ${side === 'chain' ? 'mt-5' : ''}`}>
            <span />
            <span className={head}>{side === 'db' ? 'Database says' : 'Chain sealed'}</span>
            {LEDGER.map(([k, v]) => row(k, <span className="relative min-w-0">{value(side, k, v)}</span>, 'h-8'))}
          </div>
        ))}
        {status}
      </div>
    )
  return (
    <div data-split className="col-start-1 row-start-1 opacity-0">
      <div className="grid grid-cols-[56px_minmax(0,1fr)_minmax(0,1.2fr)] gap-x-4 font-mono text-[clamp(11.5px,0.95vw,13px)] leading-none text-vault-ink">
        <span />
        <span className={head}>Database says</span>
        <span className={head}>Chain sealed</span>
        {LEDGER.map(([k, v]) =>
          row(
            k,
            <>
              <span className="relative min-w-0">{value('db', k, v)}</span>
              <span className="relative min-w-0">{value('chain', k, v)}</span>
            </>,
            'h-9',
          ),
        )}
      </div>
      {status}
    </div>
  )
}

// ---- mobile / reduced motion: stacked beats ------------------------------------------------------

function Stacked() {
  return (
    <div data-stack className={SHOW_STACK}>
      <div className="vault grain mx-3 overflow-hidden rounded-xl bg-vault px-5 pb-14 pt-12 text-vault-ink sm:mx-6 sm:px-10 md:pb-20 md:pt-16">
        <h2 className="display text-[clamp(32px,8.6vw,48px)] font-semibold">
          {H2_A[0]} <span className="text-vault-ink-2">{H2_A[1]}</span>
        </h2>
        {BEATS.map((b, k) => (
          <div key={b.id} data-mbeat={k} className="mt-14 md:mt-20">
            {k === 3 ? (
              <h2 className="display mb-12 border-t border-vault-line pt-12 text-[clamp(32px,8.6vw,48px)] font-semibold md:mb-16 md:pt-16">
                {H2_B[0]} <span className="text-vault-ink-2">{H2_B[1]}</span>
              </h2>
            ) : null}
            <div className="sm:grid sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:items-center sm:gap-10">
              <div className="mx-auto w-full max-w-[340px]">
                {/* the step word: above the object on narrow screens so every letter reads (desktop keeps it behind) */}
                <div
                  aria-hidden="true"
                  className={`mx-auto flex justify-between text-[clamp(40px,12vw,52px)] font-extralight leading-none ${k === 4 ? 'text-bad-v/70' : 'text-dot'}`}
                  style={{ width: `${Math.min(100, b.word.length * 15)}%` }}
                >
                  {b.word.split('').map((ch, i) => (
                    <span key={i}>{ch}</span>
                  ))}
                </div>
                <div data-mstage className="relative mt-2 w-full">
                  <div className="relative aspect-square w-full">
                    <canvas data-mcanvas aria-hidden="true" className="absolute inset-0 h-full w-full" />
                  </div>
                  {k === 4 ? (
                    <div
                      data-mstamp
                      aria-hidden="true"
                      className="absolute left-1/2 top-[79%] rounded-lg border-[3px] border-bad-v px-4 py-1 font-mono text-[28px] font-bold tracking-[0.12em] text-bad-v opacity-0 transition-[opacity,transform] duration-300"
                      style={{ background: 'rgba(36,33,29,.82)', transform: 'translate(-50%,-50%) rotate(-8deg) scale(1.5)' }}
                    >
                      ALTERED
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="min-w-0">
                <h3 className="mt-6 text-[24px] font-medium leading-tight tracking-[-0.02em] sm:mt-0 md:text-[28px]">{COPY[k].h}</h3>
                <p className="mt-2 max-w-[44ch] text-[16px] leading-normal text-vault-ink-2">{COPY[k].p}</p>
                <ul className="mt-5 flex flex-col items-start gap-2">
                  {CALLOUTS.filter((c) => Math.floor(c.t[0]) === k && !c.live).map((c) => (
                    <li
                      key={c.id}
                      data-mrow={(c.t[0] - k).toFixed(2)}
                      className="flex h-8 max-w-full items-stretch opacity-0 transition-[opacity,transform] duration-500"
                    >
                      <span className={`label flex shrink-0 items-center rounded-l-sm px-3 font-semibold ${TAG[c.tone]}`}>{c.tag}</span>
                      <span className="flex min-w-0 items-center truncate rounded-r-sm border border-l-0 border-vault-line bg-vault-2 px-3 font-mono text-[13px] text-vault-ink">
                        {c.value}
                      </span>
                    </li>
                  ))}
                </ul>
                {k === 3 ? <Split mobile /> : null}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---- controllers (imperative; no React state on the scroll path) ----------------------------------

const $ = <T extends HTMLElement = HTMLElement>(root: ParentNode, sel: string) => root.querySelector<T>(sel)
const $$ = <T extends HTMLElement = HTMLElement>(root: ParentNode, sel: string) => Array.from(root.querySelectorAll<T>(sel))

type SplitEls = {
  root: HTMLElement | null
  db: HTMLElement | null
  caret: HTMLElement | null
  band: HTMLElement | null
  markDb: HTMLElement | null
  markChain: HTMLElement | null
  chain: HTMLElement | null
  match: HTMLElement | null
  altered: HTMLElement | null
}
const splitEls = (root: ParentNode): SplitEls => ({
  root: $(root, '[data-split]'),
  db: $(root, '[data-did-db]'),
  caret: $(root, '[data-caret]'),
  band: $(root, '[data-did-band]'),
  markDb: $(root, '[data-mark-db]'),
  markChain: $(root, '[data-mark-chain]'),
  chain: $(root, '[data-did-chain]'),
  match: $(root, '[data-status="match"]'),
  altered: $(root, '[data-status="altered"]'),
})

/** Drive the diff ledger from film time T (EDIT = 3..4, ALTERED = 4..5). */
function applySplit(s: SplitEls, T: number) {
  const txt = didText(T)
  if (s.db && s.db.textContent !== txt) s.db.textContent = txt
  if (s.caret) s.caret.style.opacity = T > 3.3 && T < 3.95 ? '1' : '0'
  const bad = win(T, 4.4, 4.5)
  for (const el of [s.band, s.markDb, s.markChain]) if (el) el.style.opacity = bad.toFixed(3)
  if (s.db) s.db.style.color = bad > 0.5 ? 'var(--color-bad-v)' : ''
  if (s.chain) s.chain.style.color = bad > 0.5 ? 'var(--color-ice)' : ''
  if (s.match) s.match.style.opacity = T >= 4.4 ? '0' : '1'
  if (s.altered) s.altered.style.opacity = win(T, 4.4, 4.48).toFixed(3)
}

const SHAKE: Keyframe[] = [
  { transform: 'translateX(0)' },
  { transform: 'translateX(-6px)' },
  { transform: 'translateX(5px)' },
  { transform: 'translateX(-3px)' },
  { transform: 'translateX(0)' },
]

function runPinned(root: HTMLElement): () => void {
  const wrap = $(root, '[data-pin]')
  const slab = $(root, '[data-slab]')
  const stage = $(root, '[data-stage]')
  const canvas = $<HTMLCanvasElement>(root, '[data-canvas]')
  if (!wrap || !slab || !stage || !canvas) return () => {}
  const renderer = createLatticeRenderer(canvas, { backdrop: true })
  if (!renderer) return () => {}

  const frame = createFrame()
  const tint = $(root, '[data-tint]')
  const stamp = $(root, '[data-stamp]')
  const words = $$(root, '[data-word]').map((el) => ({ el, inner: $(el, '[data-word-in]') }))
  const copies = $$(root, '[data-copy]')
  const h2s = $$(root, '[data-h2]')
  const chips = $$(root, '[data-chips]')
  const segs = $$(root, '[data-seg]')
  const segLabels = $$(root, '[data-seg-label]')
  const split = splitEls(root)
  const cos = CALLOUTS.map((def) => {
    const el = $(root, `[data-co="${def.id}"]`)!
    return {
      def,
      el,
      lead: $(el, '[data-lead]')!,
      vlead: $(el, '[data-vlead]')!,
      plate: $(el, '[data-plate]')!,
      tag: $(el, '[data-tag]')!,
      val: $(el, '[data-val]')!,
      text: def.value,
      w: 0,
      a: 0,
    }
  })
  type Co = (typeof cos)[number]
  const setText = (c: Co, txt: string) => {
    if (txt === c.text) return
    c.val.textContent = txt || '\u00a0'
    c.text = txt
  }
  let tweening = false
  let lastNow = 0

  let pinPx = 1
  let lastP = -1
  let lastT = 0
  let raf = 0
  let visible = true

  const layout = () => {
    const sr = slab.getBoundingClientRect()
    const st = stage.getBoundingClientRect()
    renderer.resize(st.width)
    pinPx = Math.max(1, wrap.offsetHeight - window.innerHeight)
    const pitch = st.width / 40
    const ox = st.left - sr.left
    const oy = st.top - sr.top
    const pad = Math.min(48, Math.max(24, sr.width * 0.03))
    for (const c of cos) {
      c.val.textContent = c.def.value
      c.plate.style.width = ''
      c.w = Math.ceil(c.plate.offsetWidth)
      const ax = Math.round(ox + c.def.at[0] * pitch)
      const ay = Math.round(oy + c.def.at[1] * pitch)
      const dy = Math.round(oy + c.def.plateY * pitch) - ay
      // plates dock right-aligned inside the slab, never clipped, never left of their anchor
      // fallback: if the plate cannot fit right of its anchor, slide it left so it is never clipped
      const px = Math.min(Math.max(ax + 24, sr.width - pad - c.w), sr.width - 16 - c.w)
      c.el.style.left = `${ax}px`
      c.el.style.top = `${ay}px`
      c.plate.style.left = `${px - ax}px`
      c.plate.style.top = `${dy}px`
      c.plate.style.width = c.def.live ? '' : `${c.w}px` // live value shrinks with the edit
      c.lead.style.top = `${dy}px`
      c.lead.style.width = `${px - ax}px`
      c.vlead.style.top = `${Math.min(0, dy)}px`
      c.vlead.style.height = `${Math.abs(dy)}px`
      c.vlead.style.transformOrigin = dy < 0 ? 'bottom' : 'top'
      c.text = ''
    }
    lastP = -1
  }

  const update = (now: number) => {
    raf = 0
    const r = wrap.getBoundingClientRect()
    const P = clamp01(-r.top / pinPx)
    const T = toT(P)
    const ambient = T > 4.65 && visible
    const dt = Math.min(50, lastNow ? now - lastNow : 16)
    lastNow = now
    if (Math.abs(P - lastP) < 0.00005 && !ambient && !tweening) return
    lastP = P

    storyFrameAtT(frame, T, ambient ? now : 0)
    renderer.draw(frame)


    // giant step word: blur in / out at the beat edges, letters spread through the beat
    words.forEach(({ el, inner }, k) => {
      const inn = k === 0 ? 1 : win(T, k - 0.07, k + 0.07)
      const out = k === BEATS.length - 1 ? 0 : win(T, k + 0.93, k + 1.07)
      const v = inn * (1 - out)
      el.style.opacity = v.toFixed(3)
      el.style.filter = v < 0.999 ? `blur(${((1 - v) * 16).toFixed(1)}px)` : ''
      if (inner) inner.style.width = `${(80 + 22 * clamp01(T - k)).toFixed(2)}%`
    })

    // copy: outgoing rises and blurs out, incoming rises in from 24px below
    copies.forEach((el, k) => {
      const inn = k === 0 ? 1 : win(T, k + 0.03, k + 0.15)
      const out = k === BEATS.length - 1 ? 0 : win(T, k + 0.98, k + 1.08)
      const v = inn * (1 - out)
      el.style.opacity = v.toFixed(3)
      el.style.transform = `translateY(${((1 - inn) * 24 - out * 24).toFixed(1)}px)`
      el.style.filter = v < 0.999 ? `blur(${((1 - inn + out) * 8).toFixed(1)}px)` : ''
    })
    h2s.forEach((el, k) => {
      const v = k === 0 ? 1 - win(T, 2.97, 3.07) : win(T, 3.03, 3.15)
      el.style.opacity = v.toFixed(3)
      el.style.filter = v < 0.999 ? `blur(${((1 - v) * 10).toFixed(1)}px)` : ''
      el.style.transform = `translateY(${((k === 0 ? -1 : 1) * (1 - v) * 20).toFixed(1)}px)`
    })
    chips.forEach((el, k) => {
      const [a, b] = CHIPS[k].t
      const v = win(T, a, a + 0.08) * (1 - win(T, b, b + 0.06))
      el.style.opacity = v.toFixed(3)
      el.style.transform = `translateY(${((1 - v) * 10).toFixed(1)}px)`
    })
    if (split.root) {
      const v = win(T, 3.0, 3.2)
      split.root.style.opacity = v.toFixed(3)
      split.root.style.transform = `translateY(${((1 - v) * 16).toFixed(1)}px)`
      split.root.style.filter = v < 0.999 ? `blur(${((1 - v) * 6).toFixed(1)}px)` : ''
    }
    applySplit(split, T)

    // progress
    segs.forEach((el, k) => (el.style.transform = `scaleX(${clamp01(T - k).toFixed(3)})`))
    segLabels.forEach((el, k) => {
      const on = T >= k && (T < k + 1 || (k === BEATS.length - 1 && T >= k))
      el.style.color = on ? (k === 4 ? 'var(--color-bad-v)' : 'var(--color-ice)') : ''
    })

    // the verdict: tint, stamp, single shake on the downward crossing
    const hit = win(T, 4.38, 4.5)
    if (tint) tint.style.opacity = (hit * (1 - 0.45 * win(T, 4.5, 4.75))).toFixed(3)
    if (stamp) {
      const s = win(T, 4.4, 4.5)
      stamp.style.opacity = s.toFixed(3)
      stamp.style.transform = `translate(-50%,-50%) rotate(-8deg) scale(${(1.7 - 0.7 * easeOutExpo(s)).toFixed(3)})`
      stamp.style.filter = s < 0.999 ? `blur(${((1 - s) * 10).toFixed(1)}px)` : ''
    }
    if (lastT < 4.4 && T >= 4.4 && T - lastT < 0.3) stage.animate(SHAKE, { duration: 300, easing: 'ease-out' })
    lastT = T

    // callouts: scroll decides WHEN a plate is shown (crossing its entry point), a short timed tween
    // plays the reveal (leader, tag, wipe, scramble) so a paused scroll never freezes a half-drawn
    // plate. Scrolling back above the entry point plays it in reverse. Previous = cleanly dimmed.
    tweening = false
    const seed = Math.floor(now / 42)
    for (const c of cos) {
      const [tin, tprev, tout] = c.def.t
      const target = T >= tin ? 1 : 0
      if (c.a !== target) {
        c.a = target ? Math.min(1, c.a + dt / REVEAL_MS) : Math.max(0, c.a - dt / (REVEAL_MS * 0.6))
        if (c.a !== target) tweening = true
      }
      const a = c.a
      const op = Math.min(1, a * 4) * (1 - 0.65 * win(T, tprev, tprev + 0.06)) * (1 - win(T, tout, tout + 0.06))
      c.el.style.opacity = op.toFixed(3)
      if (op <= 0) continue
      const hasV = c.vlead.style.height !== '0px'
      c.vlead.style.transform = `scaleY(${easeOutExpo(win(a, 0, hasV ? 0.25 : 0.01)).toFixed(3)})`
      c.lead.style.transform = `scaleX(${easeOutExpo(win(a, hasV ? 0.2 : 0, 0.5)).toFixed(3)})`
      c.tag.style.opacity = win(a, 0.25, 0.5).toFixed(3)
      c.val.style.clipPath = a >= 1 ? '' : `inset(0 ${(100 - 100 * easeOutExpo(win(a, 0.35, 0.8))).toFixed(1)}% 0 0)`
      setText(c, scrambleText(c.def.live ? didText(T) : c.def.value, win(a, 0.45, 1), seed))
    }

    if (ambient || tweening) raf = requestAnimationFrame(update)
  }

  const kick = () => {
    if (!raf && visible) raf = requestAnimationFrame(update)
  }
  const ro = new ResizeObserver(() => {
    layout()
    kick()
  })
  ro.observe(slab)
  ro.observe(stage)
  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting
    kick()
  })
  io.observe(wrap)
  window.addEventListener('scroll', kick, { passive: true })
  document.fonts?.ready.then(() => {
    layout()
    kick()
  })
  layout()
  kick()

  return () => {
    cancelAnimationFrame(raf)
    ro.disconnect()
    io.disconnect()
    window.removeEventListener('scroll', kick)
  }
}

const REVEAL_MS = 480
const M_DUR = [2000, 2200, 1500, 2400, 1400]

function runStacked(root: HTMLElement, reduced: boolean): () => void {
  const blocks = $$(root, '[data-mbeat]')
  const cleanups: Array<() => void> = []
  blocks.forEach((block, k) => {
    const canvas = $<HTMLCanvasElement>(block, '[data-mcanvas]')
    const box = canvas?.parentElement
    if (!canvas || !box) return
    const r: LatticeRenderer | null = createLatticeRenderer(canvas, { backdrop: true })
    if (!r) return
    const frame = createFrame()
    const rows = $$(block, '[data-mrow]').map((el) => ({ el, at: Number(el.dataset.mrow) }))
    const split = k === 3 ? splitEls(block) : k === 4 ? splitEls(blocks[3]) : null
    const stamp = $(block, '[data-mstamp]')
    const stageEl = $(block, '[data-mstage]')
    let q = reduced ? 1 : 0
    let raf = 0
    let started = reduced
    let shaken = false

    const apply = () => {
      storyFrame(frame, k, q)
      r.draw(frame)
      rows.forEach(({ el, at }) => {
        const on = q >= at
        el.style.opacity = on ? '1' : '0'
        el.style.transform = on ? 'none' : 'translateY(8px)'
      })
      if (split) applySplit(split, k + q)
      if (stamp) {
        const on = q >= 0.4
        stamp.style.opacity = on ? '1' : '0'
        stamp.style.transform = `translate(-50%,-50%) rotate(-8deg) scale(${on ? 1 : 1.5})`
        if (on && !shaken && !reduced) {
          shaken = true
          stageEl?.animate(SHAKE, { duration: 300, easing: 'ease-out' })
        }
      }
    }
    const play = () => {
      const t0 = performance.now()
      const tick = (now: number) => {
        q = Math.min(1, (now - t0) / M_DUR[k])
        apply()
        raf = q < 1 ? requestAnimationFrame(tick) : 0
      }
      raf = requestAnimationFrame(tick)
    }
    const ro = new ResizeObserver(() => {
      r.resize(box.clientWidth)
      apply()
    })
    ro.observe(box)
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting || started) return
        started = true
        io.disconnect()
        play()
      },
      { threshold: 0.45 },
    )
    if (!reduced) io.observe(box)
    cleanups.push(() => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      io.disconnect()
    })
  })
  return () => cleanups.forEach((f) => f())
}

