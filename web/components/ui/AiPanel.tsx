'use client'

import { useEffect, useRef } from 'react'
import { words } from '@/components/landing/Words'
import type { AiMeta } from '@/lib/shared/types'
import { Act } from '@/components/citizen/Act'
import { IconRefresh, IconSpark } from './icons'
import { Skeleton } from './Skeleton'

/** Every answer says where it came from: the response's `meta.fallbackLevel`. */
export const FALLBACK_LABEL: Record<AiMeta['fallbackLevel'], string> = {
  primary: 'PRIMARY MODEL',
  fallback: 'FALLBACK MODEL',
  cached: 'CACHED ANSWER',
  template: 'TEMPLATE · AI OFFLINE',
}

// Just "AI": the provider and model stay in the server's ai_runs provenance, not on screen. Fallback levels are
// shown next to the chip where they matter (FALLBACK_LABEL).
export function AiChip(_props: { meta?: AiMeta }) {
  return (
    <span className="label inline-flex h-7 items-center gap-1.5 rounded-pill border border-ai/40 bg-ai-bg px-2.5 text-ai">
      <IconSpark size={13} strokeWidth={2.2} />
      AI
    </span>
  )
}

/**
 * AI explanation. The verdict never comes from here — the footer says so. Answer text rises in word by
 * word (same word rise as the landing headlines, 48 ms stagger, capped) when it arrives; static under
 * reduced motion and without JS.
 */
export function AiPanel({
  state,
  text,
  meta,
  error,
  onRetry,
  footer = 'AI explains only · verdict is computed by code',
}: {
  state: 'loading' | 'done' | 'error'
  text?: string
  meta?: AiMeta
  error?: string
  onRetry?: () => void
  footer?: string
}) {
  const fb = meta ? FALLBACK_LABEL[meta.fallbackLevel] : null
  const textRef = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    const el = textRef.current
    if (!el) return
    const id = requestAnimationFrame(() => el.setAttribute('data-shown', ''))
    return () => cancelAnimationFrame(id)
  }, [text, state])

  return (
    <section aria-label="AI explanation" aria-busy={state === 'loading'} className="anim-rise relative border-y border-ai/25 py-4 pl-4">
      <span aria-hidden="true" className="absolute inset-y-4 left-0 w-[2px] rounded-pill bg-ai/60" />
      <div className="flex flex-wrap items-center gap-2">
        <AiChip meta={meta} />
        {fb ? (
          <span
            className={`label inline-flex h-7 items-center rounded-pill border px-2.5 ${
              meta?.fallbackLevel === 'primary' ? 'border-line-strong bg-card text-ink-2' : 'border-pending/30 bg-pending-bg text-pending'
            }`}
          >
            {fb}
          </span>
        ) : null}
        {meta ? <span className="label ml-auto tnum text-ink-2">{(meta.latencyMs / 1000).toFixed(1)} S</span> : null}
      </div>
      <div className="mt-3.5">
        {state === 'loading' ? (
          <div className="flex flex-col gap-2.5" aria-hidden="true">
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-[92%]" />
            <Skeleton className="h-3.5 w-[78%]" />
            <Skeleton className="h-3.5 w-[60%]" />
          </div>
        ) : state === 'error' ? (
          <div className="flex flex-col items-start gap-3">
            <p className="text-[15px] leading-relaxed text-ink-2">{error}</p>
            {onRetry ? (
              <Act variant="light" size="md" icon={<IconRefresh size={15} />} onClick={onRetry}>
                Try again
              </Act>
            ) : null}
          </div>
        ) : (
          <p ref={textRef} key={text} data-words="" className="cz-ai-text text-[16px] leading-[1.6] tracking-[0.01em] text-ink">
            {words(text ?? '')}
          </p>
        )}
      </div>
      <p className="label mt-3.5 text-[11px] text-ai">{footer}</p>
    </section>
  )
}
