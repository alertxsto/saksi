'use client'

import { useEffect, useRef, type CSSProperties } from 'react'
import { CHAIN_NAME, DEPLOY_BLOCK } from '@/lib/env'
import { DIVE_QUERY_JS } from '@/lib/motion/dive'
import { scramble } from '@/lib/motion/scramble'
import { clamp, matches, range, subscribe } from '@/lib/motion/scroll'
import { Cta } from './Cta'
import { SealGL } from './SealGL'

import { SAMPLE_RECEIPT } from './sample-receipt'

// The sample receipt's real transaction (sealed on Sepolia), not a made-up fingerprint.
const FP = `${SAMPLE_RECEIPT.txHash!.slice(0, 10)}…${SAMPLE_RECEIPT.txHash!.slice(-8)}`
const d = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties

/**
 * S1 hero, contentarchitecture "dive" (17 B.1 / C.2) on zaro's chrome grid (16 S0):
 * paper copy left, a vault panel right holding the live WebGL seal. Over the first ~600 px of scroll the
 * vault clip-path grows from the panel to the whole viewport, the copy slides 96 px left while fading
 * 1.5× faster, and the seal travels to the centre. The page has then *become* the vault; a dot curtain
 * dissolves it back into paper. Desktop + motion + JS only — otherwise it is a static split (no CLS:
 * the tall track is CSS-gated by the same media query).
 */
export function HeroDive() {
  const trackRef = useRef<HTMLElement>(null)
  const backRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const sealRef = useRef<HTMLDivElement>(null)
  const copyRef = useRef<HTMLDivElement>(null)
  const hudRef = useRef<HTMLDivElement>(null)
  const fpRef = useRef<HTMLElement>(null)
  const blockRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const reduced = matches('(prefers-reduced-motion: reduce)')
    const fp = fpRef.current
    const stopFp = fp && !reduced ? scramble(fp, FP, { stepMs: 34 }) : null

    const track = trackRef.current
    const back = backRef.current
    const panel = panelRef.current
    const seal = sealRef.current
    const copy = copyRef.current
    const hud = hudRef.current
    if (!track || !back || !panel || !seal || !copy || !hud) return () => stopFp?.()

    let dive = false
    let hudOn = false
    const mq = window.matchMedia(DIVE_QUERY_JS)
    const sync = () => {
      dive = mq.matches
      if (dive) track.setAttribute('data-ready', '')
      else {
        track.removeAttribute('data-ready')
        track.removeAttribute('data-surface')
        for (const el of [back, seal, copy, hud]) el.removeAttribute('style')
      }
    }
    sync()
    mq.addEventListener('change', sync)

    const unsub = subscribe(() => {
      if (!dive) return
      const vh = window.innerHeight
      if (track.getBoundingClientRect().bottom < -vh) return // long gone: nothing to update
      const t = clamp(window.scrollY / Math.min(620, vh * 0.72))
      const e = t * t * (3 - 2 * t)
      const P = panel.getBoundingClientRect()
      const S = back.getBoundingClientRect()
      const top = (P.top - S.top) * (1 - e)
      const left = (P.left - S.left) * (1 - e)
      const right = (S.right - P.right) * (1 - e)
      const bottom = (S.bottom - P.bottom) * (1 - e)
      back.style.clipPath = `inset(${top}px ${right}px ${bottom}px ${left}px round ${24 * (1 - e)}px)`

      const s0 = seal.offsetWidth
      // stage-local coordinates, so the maths holds after the sticky stage scrolls away
      const cx = P.left - S.left + P.width / 2
      const cy = P.top - S.top + P.height / 2
      const hold = clamp((window.scrollY - Math.min(620, vh * 0.72)) / 400)
      const k = (1 + (Math.min(1.14, (S.height - 150) / s0) - 1) * e) * (1 + 0.06 * hold)
      seal.style.transform = `translate(${(S.width / 2 - cx) * e}px, ${(S.height / 2 + 12 - cy) * e}px) scale(${k})`

      copy.style.opacity = String(clamp(1 - 1.5 * t))
      copy.style.transform = `translateX(${-96 * t}px)`
      copy.style.visibility = t > 0.7 ? 'hidden' : ''

      const h = range(0.55, 0.95, t)
      hud.style.opacity = String(h)
      hud.style.filter = `blur(${(1 - h) * 8}px)`
      if (h > 0.6 && !hudOn && blockRef.current && DEPLOY_BLOCK && !reduced) scramble(blockRef.current, DEPLOY_BLOCK, { alphabet: '0123456789', keep: /,/ })
      hudOn = h > 0.6

      if (t > 0.45) track.setAttribute('data-surface', 'vault')
      else track.removeAttribute('data-surface')
    })

    return () => {
      unsub()
      mq.removeEventListener('change', sync)
      stopFp?.()
    }
  }, [])

  return (
    <section ref={trackRef} id="top" aria-labelledby="hero-title" className="hero-track relative">
      <div className="hero-stage">
        {/* full-stage vault, clipped to the panel at rest (dive mode only) */}
        <div ref={backRef} aria-hidden="true" className="hero-back vault grain absolute inset-0 bg-vault">
          <div ref={hudRef} className="hero-hud absolute inset-0 opacity-0">
            <ol className="absolute left-[max(24px,calc(50%-620px))] top-28 flex flex-col gap-2">
              {['01 RECORD · a company logs an access', '02 SEAL · its fingerprint goes on chain', '03 VERIFY · your phone checks it'].map(
                (s, i) => (
                  <li key={s} className="label flex items-center gap-2 text-[12px] text-vault-ink-2">
                    <span className={`size-[7px] rounded-[2px] ${i === 1 ? 'bg-ice' : 'bg-dot'}`} />
                    {s}
                  </li>
                ),
              )}
            </ol>
            <div className="absolute right-[max(24px,calc(50%-620px))] top-28 flex h-[calc(100%-200px)] flex-col items-end justify-between">
              {[
                ['NOW', 'bg-ice'],
                ['SEALED 14:03 WIB', 'bg-dot-2'],
                ['DATABASE COPY', 'bg-dot'],
              ].map(([l, c]) => (
                <span key={l} className="label flex items-center gap-2 text-[12px] text-vault-ink-2">
                  {l}
                  <span className={`h-px w-6 ${c}`} />
                </span>
              ))}
            </div>
            <p className="label absolute bottom-8 left-[max(24px,calc(50%-620px))] text-[12px] text-vault-ink-2">
              {DEPLOY_BLOCK ? (
                <>
                  Contracts deployed at block <code ref={blockRef} className="text-vault-ink">{DEPLOY_BLOCK}</code> ·{' '}
                </>
              ) : null}
              {CHAIN_NAME}
            </p>
            <p className="label absolute bottom-8 right-[max(24px,calc(50%-620px))] text-[12px] text-vault-ink-2">
              Hash only · no names · no ID numbers
            </p>
          </div>
        </div>

        <div className="chrome hero-chrome relative grid min-h-full items-center gap-10 pb-10 pt-28 lg:grid-cols-[minmax(0,480px)_minmax(0,1fr)] xl:grid-cols-[minmax(0,540px)_minmax(0,1fr)] lg:gap-6 lg:pb-8 lg:pt-24">
          <div ref={copyRef} className="hero-copy relative z-[1]">
            <h1 id="hero-title" className="text-balance text-[40px] font-medium leading-[1.03] tracking-[-0.02em] sm:text-[52px] lg:text-[64px] xl:text-[72px]">
              <span className="m-line">
                <span style={d(40)}>Who opened your data?</span>
              </span>
              <span className="m-line text-ink-2">
                <span style={d(160)}>Now there’s a witness.</span>
              </span>
            </h1>
            <p className="m-in mt-6 max-w-[46ch] text-[17px] leading-[1.6] tracking-[0.01em] text-ink-2 md:text-[18px]" style={d(280)}>
              Every time a company touches your data, Saksi seals a fingerprint of that record on a public chain. Your
              phone can check it, so nobody, not even an insider, can quietly rewrite the story.
            </p>
            <div className="m-in mt-8 flex flex-wrap gap-2.5 sm:gap-3" style={d(380)}>
              <Cta href="/enter" className="max-sm:pl-4 max-sm:text-[15px]">
                Open the app
              </Cta>
              <Cta href="/proof" variant="light" className="max-sm:px-4 max-sm:text-[15px] max-[379px]:hidden">
                Verify a receipt
              </Cta>
              <Cta href="/proof" variant="light" className="px-4 text-[15px] min-[380px]:hidden">
                Verify
              </Cta>
            </div>
            <ul className="m-in label mt-10 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-ink-2 max-sm:mt-8 max-sm:gap-x-5" style={d(480)}>
              <li>Hash only on chain</li>
              <li aria-hidden="true" className="h-4 w-px bg-line-strong max-sm:hidden" />
              <li>No wallet for citizens</li>
              <li aria-hidden="true" className="h-4 w-px bg-line-strong max-sm:hidden" />
              <li className="flex items-center gap-2">
                Fingerprint{' '}
                <code ref={fpRef} className="font-mono normal-case tracking-normal text-blue">
                  {FP}
                </code>
              </li>
            </ul>
          </div>

          <div
            ref={panelRef}
            className="hero-panel vault grain relative aspect-square w-full rounded-xl bg-vault md:aspect-[4/3] lg:aspect-auto lg:h-[min(calc(100svh-128px),780px)]"
          >
            <div
              ref={sealRef}
              className="hero-seal absolute left-1/2 top-1/2 aspect-square w-[min(100cqw-48px,100cqh-48px)] -translate-x-1/2 -translate-y-1/2 lg:w-[min(100cqw-112px,100cqh-112px)] [&>*]:rounded-none [&>*]:border-0 [&>*]:bg-transparent [&>*]:after:hidden"
            >
              <SealGL overlay={false} title="Saksi seal: a padlock whose keyhole is a check mark" />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
