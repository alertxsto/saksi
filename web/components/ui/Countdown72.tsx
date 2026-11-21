'use client'

import { hms } from '@/lib/format'
import { useNow } from '@/lib/hooks'
import { DotIcon } from './DotIcon'
import { DotoValue } from './DotoValue'

const WINDOW_SEC = 72 * 3600

/** Big Doto countdown of the 72-hour UU PDP window, with a ticked 0/24/48/72 H bar. */
export function Countdown72({ detectedAtSec, size = 'lg' }: { detectedAtSec: number; size?: 'lg' | 'md' }) {
  const now = useNow()
  const nowSec = now ? Math.floor(now / 1000) : 0
  const used = nowSec ? Math.max(0, nowSec - detectedAtSec) : 0
  const left = WINDOW_SEC - used
  const late = nowSec > 0 && left < 0
  const pct = Math.min(100, (used / WINDOW_SEC) * 100)
  const warn = !late && left < 12 * 3600
  const lateH = late ? Math.ceil(-left / 3600) : 0

  return (
    <div className="@container flex flex-col gap-3">
      <p className={`label flex items-center gap-1.5 ${late ? 'text-bad' : warn ? 'text-pending' : 'text-ink-2'}`}>
        {late ? <DotIcon name="cross" size={16} /> : <DotIcon name="clock" size={16} />}
        {late ? 'Past the 72-hour window' : 'Left of the 72-hour window'}
      </p>
      <p
        className={`whitespace-nowrap ${late ? 'text-[44px] sm:text-[52px]' : size === 'lg' ? 'text-[clamp(40px,19cqw,84px)]' : 'text-[clamp(32px,14cqw,48px)]'} ${late ? 'text-bad' : 'text-ink'}`}
        role="timer"
        aria-live="off"
        aria-label={late ? `Late by ${lateH} hours` : `${hms(left)} left`}
      >
        {!nowSec ? (
          '--:--:--'
        ) : late ? (
          <span className="inline-flex items-baseline gap-[0.3em]">
            <span className="font-mono text-[0.6em] font-medium uppercase leading-none tracking-[0.04em]">Late by</span>
            <DotoValue value={String(lateH)} unit="H" />
          </span>
        ) : (
          <DotoValue value={hms(left)} />
        )}
      </p>
      <div>
        <div className="relative h-2.5 overflow-hidden rounded-pill bg-paper-2">
          <div
            className={`absolute inset-y-0 left-0 ${late ? 'bg-bad' : warn ? 'bg-pending' : 'bg-ink'}`}
            style={{ width: `${pct}%` }}
          />
          {[24, 48].map((h) => (
            <span key={h} aria-hidden="true" className="absolute inset-y-0 w-px bg-paper" style={{ left: `${(h / 72) * 100}%` }} />
          ))}
        </div>
        <div className="mt-1.5 flex justify-between font-mono text-[11px] text-ink-2" aria-hidden="true">
          <span>0 H</span>
          <span>24 H</span>
          <span>48 H</span>
          <span className="text-bad">72 H</span>
        </div>
      </div>
    </div>
  )
}
