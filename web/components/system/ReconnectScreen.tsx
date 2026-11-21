'use client'

import { type CSSProperties, useCallback, useEffect, useRef, useState } from 'react'
import { Cta } from '@/components/landing/Cta'
import { IconWifiOff } from '@/components/ui/icons'
import { CHAIN_NAME } from '@/lib/env'
import { useOnline } from '@/lib/hooks'
import { CtaButton } from './CtaButton'
import { ReconnectArt } from './SystemArt'
import { MetaRule, SystemMeta, SystemScreen } from './SystemScreen'

/** Seconds between automatic retries. */
export const RETRY_EVERY = 5
const CHECKING_MS = 1400

// A failed retry remounts the error component (the boundary renders its children again, they throw again),
// so the attempt count lives at module scope. It starts over after a quiet minute.
const attempts = { n: 0, at: 0 }
const readAttempts = () => (Date.now() - attempts.at > 60_000 ? 0 : attempts.n)
const bumpAttempts = () => {
  attempts.n = readAttempts() + 1
  attempts.at = Date.now()
  return attempts.n
}

export type ReconnectPhase = 'waiting' | 'checking' | 'offline'

/** Pure view: every value arrives as a prop (the /dev/system gallery renders each phase directly). */
export function ReconnectView({
  phase,
  secondsLeft,
  attempt,
  reference,
  onRetry,
  chrome = 'page',
}: {
  phase: ReconnectPhase
  secondsLeft: number
  attempt: number
  reference?: string
  onRetry: () => void
  chrome?: 'page' | 'embedded'
}) {
  const offline = phase === 'offline'
  return (
    <SystemScreen
      chrome={chrome}
      art={<ReconnectArt idle={offline} />}
      wide
      title={offline ? 'You’re offline.' : 'Saksi is reconnecting to the chain…'}
      tail={offline ? 'Saksi will reconnect when you’re back.' : 'Your receipts are safe.'}
      body={
        offline ? (
          'Nothing you sealed lives on this phone or this server alone. As soon as the connection returns, this page picks up where it was.'
        ) : (
          <>
            The server or the chain connection dropped for a moment. Nothing sealed is lost: every fingerprint is already on{' '}
            <span className="text-ink">{CHAIN_NAME}</span>, not on this server.
          </>
        )
      }
      status={<RetryStatus phase={phase} secondsLeft={secondsLeft} />}
      actions={
        <>
          <CtaButton onClick={onRetry} busy={phase === 'checking'} className="justify-between max-sm:w-full">
            Try again
          </CtaButton>
          <Cta href="/" variant="light" className="justify-center max-sm:w-full">
            Go home
          </Cta>
        </>
      }
      meta={
        attempt > 0 || reference ? (
          <>
            {attempt > 0 ? <SystemMeta label="Attempt">{attempt + (phase === 'checking' ? 0 : 1)}</SystemMeta> : null}
            {attempt > 0 && reference ? <MetaRule /> : null}
            {reference ? <SystemMeta label="Ref">{reference}</SystemMeta> : null}
          </>
        ) : undefined
      }
    />
  )
}

/** Five dots, one goes dark per second: the countdown in the lattice's own grammar. Calm, never red. */
function RetryStatus({ phase, secondsLeft }: { phase: ReconnectPhase; secondsLeft: number }) {
  if (phase === 'offline') {
    return (
      <p className="flex items-center gap-2.5 text-[15px] tracking-[0.01em] text-ink-2">
        <IconWifiOff size={16} className="shrink-0 text-unknown" />
        Waiting for a connection. No need to reload.
      </p>
    )
  }
  const checking = phase === 'checking'
  return (
    <div className="flex items-center gap-4">
      <span className="flex items-center gap-[7px]" aria-hidden="true">
        {Array.from({ length: RETRY_EVERY }, (_, k) => (
          <span
            key={k}
            className={`sys-tick size-[9px] rounded-full ${checking ? 'sys-tick-run bg-blue' : k < secondsLeft ? 'bg-ink' : 'bg-line'}`}
            style={checking ? ({ '--k': k } as CSSProperties) : undefined}
          />
        ))}
      </span>
      <span className="text-[15px] tracking-[0.01em] text-ink-2" aria-hidden="true">
        {checking ? (
          'Checking the chain…'
        ) : (
          <>
            Trying again in{' '}
            <span className="tnum font-medium text-ink">
              {/* the digit rises in on each change (300 ms state transition, STYLE LOCK) */}
              <span className="sys-num-win">
                <span key={secondsLeft} className="sys-num">
                  {secondsLeft}
                </span>
              </span>
              &nbsp;s
            </span>
          </>
        )}
      </span>
      <span className="sr-only" role="status">
        {checking ? 'Checking the connection.' : `Saksi tries again automatically every ${RETRY_EVERY} seconds.`}
      </span>
    </div>
  )
}

/**
 * Container for app/error.tsx and app/global-error.tsx. Counts down from 5 s, then calls `retry` (re-fetch +
 * re-render of the failed segment). Pauses while offline and retries the moment the browser is back online.
 */
export function ReconnectScreen({ error, retry, chrome }: { error: unknown; retry: () => void; chrome?: 'page' | 'embedded' }) {
  const online = useOnline()
  const [now, setNow] = useState(() => Date.now())
  const [deadline, setDeadline] = useState(() => Date.now() + RETRY_EVERY * 1000)
  const [checking, setChecking] = useState(false)
  const [attempt, setAttempt] = useState(readAttempts)
  const retryRef = useRef(retry)
  const timer = useRef(0)

  useEffect(() => {
    retryRef.current = retry
  }, [retry])

  useEffect(() => {
    console.error(error)
  }, [error])

  const onRetry = useCallback(() => {
    setAttempt(bumpAttempts())
    setChecking(true)
    setDeadline(Date.now() + CHECKING_MS + RETRY_EVERY * 1000)
    retryRef.current()
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setChecking(false), CHECKING_MS)
  }, [])

  // tick while waiting; the retry fires from the interval callback, never during render or a state update.
  // Offline pauses the tick; the 'online' listener below retries the moment the connection returns.
  const waiting = online && !checking
  useEffect(() => {
    if (!waiting) return
    const id = window.setInterval(() => {
      const t = Date.now()
      if (t >= deadline) onRetry()
      else setNow(t)
    }, 250)
    return () => window.clearInterval(id)
  }, [waiting, deadline, onRetry])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  useEffect(() => {
    window.addEventListener('online', onRetry)
    return () => window.removeEventListener('online', onRetry)
  }, [onRetry])

  const left = Math.ceil((deadline - now) / 1000)
  const reference = error instanceof Error && 'digest' in error && typeof error.digest === 'string' ? error.digest : undefined

  return (
    <ReconnectView
      chrome={chrome}
      phase={!online ? 'offline' : checking ? 'checking' : 'waiting'}
      secondsLeft={Math.min(RETRY_EVERY, Math.max(1, left))}
      attempt={attempt}
      reference={reference}
      onRetry={onRetry}
    />
  )
}
