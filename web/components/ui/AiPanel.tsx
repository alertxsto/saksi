import type { AiMeta } from '@/lib/shared/types'
import { Button } from './Button'
import { IconRefresh, IconSpark } from './icons'
import { Skeleton } from './Skeleton'

/** Every answer says where it came from: the response's `meta.fallbackLevel`. */
export const FALLBACK_LABEL: Record<AiMeta['fallbackLevel'], string> = {
  primary: 'PRIMARY MODEL',
  fallback: 'FALLBACK MODEL',
  cached: 'CACHED ANSWER',
  template: 'TEMPLATE · AI OFFLINE',
}

export function AiChip({ meta }: { meta?: AiMeta }) {
  return (
    <span className="label inline-flex h-7 items-center gap-1.5 rounded-pill border border-ai/40 bg-ai-bg px-2.5 text-ai">
      <IconSpark size={13} strokeWidth={2.2} />
      AI · {meta ? `${meta.provider} · ${meta.model}` : '…'}
    </span>
  )
}

/** AI explanation. The verdict never comes from here — the footer says so. */
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
  return (
    <section aria-label="AI explanation" aria-busy={state === 'loading'} className="anim-rise overflow-hidden rounded-lg border border-ai/30 bg-card">
      <div className="flex flex-wrap items-center gap-2 border-b border-ai/20 px-4 py-3">
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
        {meta ? <span className="label ml-auto text-ink-2">{(meta.latencyMs / 1000).toFixed(1)} S</span> : null}
      </div>
      <div className="px-4 py-4">
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
              <Button variant="light" size="sm" icon={<IconRefresh size={15} />} onClick={onRetry}>
                Try again
              </Button>
            ) : null}
          </div>
        ) : (
          <p className="text-[15px] leading-relaxed text-ink">{text}</p>
        )}
      </div>
      <p className="label border-t border-dashed border-ai/25 px-4 py-2.5 text-[11px] text-ai">{footer}</p>
    </section>
  )
}
