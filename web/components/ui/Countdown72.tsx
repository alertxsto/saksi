'use client'

import { useLayoutEffect, useRef, type CSSProperties } from 'react'
import { formatWIB, hms } from '@/lib/format'
import { useNow } from '@/lib/hooks'

const WINDOW_SEC = 72 * 3600
const SCALE_H = 96 // the ruler runs past the deadline so "late" has somewhere to go
const ROW = 1.25 // em, matches .ctl-odo --row

const pos = (k: number) => `translateY(${-k * ROW}em)`

/**
 * One odometer digit: a column of 0..mod-1 plus a trailing 0. Counting down 0 → 9 snaps to the
 * trailing 0 first so the column always rolls one cell, never back through every digit (and the
 * mirror case for counting up). Reduced motion: no transition (CSS).
 */
function OdoColumn({ digit, mod }: { digit: number; mod: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const prev = useRef<number | null>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const p = prev.current
    prev.current = digit
    if (p === null || p === digit) {
      el.style.transition = 'none'
      el.style.transform = pos(digit)
      return
    }
    if (p === 0 && digit === mod - 1) {
      // down-wrap: jump to the trailing 0, then roll up one cell
      el.style.transition = 'none'
      el.style.transform = pos(mod)
      void el.offsetHeight
    } else if (p === mod - 1 && digit === 0) {
      // up-wrap: roll onto the trailing 0, then swap to the leading one
      el.style.transition = ''
      el.style.transform = pos(mod)
      const snap = () => {
        el.style.transition = 'none'
        el.style.transform = pos(0)
      }
      el.addEventListener('transitionend', snap, { once: true })
      return () => el.removeEventListener('transitionend', snap)
    }
    el.style.transition = ''
    el.style.transform = pos(digit)
  }, [digit, mod])

  return (
    <span className="ctl-odo-cell doto" aria-hidden="true">
      <span ref={ref} className="ctl-odo-col" style={{ transform: pos(digit) }}>
        {Array.from({ length: mod + 1 }, (_, k) => (
          <span key={k}>{k % mod}</span>
        ))}
      </span>
    </span>
  )
}

/** HH:MM:SS (hours may grow to 3 digits) as rolling Doto columns with dot colons (BreachClock grammar). */
export function OdoClock({ text, className = '', style }: { text: string; className?: string; style?: CSSProperties }) {
  const groups = text.split(':')
  return (
    <span className={`ctl-odo ${className}`} style={style}>
      {groups.map((g, gi) => (
        <span key={gi} className="contents">
          {gi ? (
            <span className="ctl-odo-sep" aria-hidden="true">
              <i />
              <i />
            </span>
          ) : null}
          {[...g].map((ch, ci) => {
            const fromRight = g.length - 1 - ci
            const mod = gi > 0 && fromRight === 1 ? 6 : 10
            return <OdoColumn key={`${gi}-${fromRight}`} digit={Number(ch)} mod={mod} />
          })}
        </span>
      ))}
    </span>
  )
}

const pct = (h: number) => `${(Math.min(h, SCALE_H) / SCALE_H) * 100}%`

/**
 * The 72-hour UU PDP window, live: Doto odometer counting down (counting the overrun up once late), and a
 * 0–96 H ruler with the deadline at 72 H, the elapsed fill and a NOW marker (landing BreachClock spirit).
 * Colour: ink while there is time, amber under 12 H left and once past the window. A late notice is a
 * compliance fact still to be sealed, not tampering, so no red here; LATE is amber everywhere,
 * including the sealed LATE badge (red stays tamper-only).
 */
export function Countdown72({ detectedAtSec, size = 'lg' }: { detectedAtSec: number; size?: 'lg' | 'md' }) {
  const now = useNow()
  const nowSec = now ? Math.floor(now / 1000) : 0
  const used = nowSec ? Math.max(0, nowSec - detectedAtSec) : 0
  const left = WINDOW_SEC - used
  const late = nowSec > 0 && left < 0
  const warn = !late && left < 12 * 3600
  const usedH = used / 3600
  const lateH = late ? Math.ceil(-left / 3600) : 0
  const tone = late || warn ? 'text-pending' : 'text-ink'
  const fill = late || warn ? 'bg-pending' : 'bg-ink'
  const big = size === 'lg' ? 'text-[clamp(56px,15cqw,140px)]' : 'text-[clamp(38px,11cqw,72px)]'

  return (
    <div className="@container flex flex-col gap-5">
      <div className="label flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-[11px]">
        <span className={late ? 'text-pending' : warn ? 'text-pending' : 'text-ink-2'}>
          {late ? (
            <>
              Past the 72-hour window · <span className="whitespace-nowrap">late by {lateH} H</span>
            </>
          ) : warn ? 'Under 12 hours left of the window' : 'Left of the 72-hour window'}
        </span>
        <span className="whitespace-nowrap text-ink-2">{detectedAtSec ? `Deadline ${formatWIB((detectedAtSec + WINDOW_SEC) * 1000)}` : null}</span>
      </div>

      <p
        className={`flex items-center whitespace-nowrap ${big} ${tone}`}
        role="timer"
        aria-live="off"
        aria-label={late ? `Late by ${lateH} hours` : `${hms(left)} left`}
      >
        {!nowSec ? (
          <span className="font-mono text-[0.5em] text-ink-3">--:--:--</span>
        ) : (
          <>
            {late ? <span className="mr-[0.08em] font-mono text-[0.42em] font-medium leading-none">+</span> : null}
            <OdoClock text={hms(late ? -left : left)} />
          </>
        )}
      </p>

      {/* ruler: 0–96 H, a tick every 6 H, deadline at 72 H, hatched overrun zone */}
      <div className="relative h-[58px]" aria-hidden="true">
        <div className="absolute inset-x-0 top-7 h-px bg-line-strong" />
        <div className={`absolute top-[22px] h-[13px] ${late ? 'ctl-hatch-late' : 'ctl-hatch'}`} style={{ left: pct(72), right: 0 }} />
        {Array.from({ length: SCALE_H / 6 + 1 }, (_, k) => k * 6).map((h) => (
          <span key={h} className="absolute top-[22px] h-[6px] w-px bg-line-strong" style={{ left: pct(h) }} />
        ))}
        {[0, 24, 48, 72, 96].map((h) => (
          <span
            key={h}
            className={`label absolute top-0 whitespace-nowrap text-[11px] ${h === 0 ? '' : h === 96 ? '-translate-x-full' : '-translate-x-1/2'} ${h === 72 ? 'text-ink' : 'text-ink-3'}`}
            style={{ left: pct(h) }}
          >
            {h} H{h === 72 ? <span className="hidden sm:inline"> · deadline</span> : null}
          </span>
        ))}
        <span className="absolute top-[17px] h-[23px] w-px bg-ink" style={{ left: pct(72) }} />
        {nowSec ? (
          <>
            <div
              className={`absolute left-0 top-[26.5px] h-[3px] rounded-full transition-[width] duration-700 ${fill}`}
              style={{ width: pct(usedH), transitionTimingFunction: 'var(--ease-out-expo)' }}
            />
            <span
              className={`absolute top-[23.5px] size-[10px] -translate-x-1/2 rounded-full transition-[left] duration-700 ${fill}`}
              style={{ left: pct(usedH), transitionTimingFunction: 'var(--ease-out-expo)' }}
            />
            <span
              className={`label absolute top-[40px] whitespace-nowrap text-[11px] ${usedH > 84 ? '-translate-x-full' : usedH < 8 ? '' : '-translate-x-1/2'} ${tone}`}
              style={{ left: pct(usedH) }}
            >
              Now · {usedH < 10 ? usedH.toFixed(1) : Math.floor(usedH)} H
            </span>
          </>
        ) : null}
      </div>
    </div>
  )
}
