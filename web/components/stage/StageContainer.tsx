'use client'

import { useQuery } from '@tanstack/react-query'
import { useId } from 'react'
import { getStageStats, getWatchView, type StageStatsWire, type WatchView } from '@/lib/data'
import { useNow } from '@/lib/hooks'
import { toStageModel } from './model'
import { StageView } from './StageView'

const POLL_MS = 3000

/**
 * Thin container for /stage: polls GET /api/stats and GET /api/watch every 3 s (also while the tab is in the
 * background: the projector laptop often has focus elsewhere) and derives the state. A failed /api/stats
 * request = offline, with the last good data kept on screen. A failed Watch request keeps the last Watch.
 * The /dev gallery passes its own loaders.
 */
export function StageContainer({
  joinUrl,
  chainName,
  loadStats,
  loadWatch,
  pollMs = POLL_MS,
}: {
  joinUrl: string
  chainName: string
  loadStats?: () => Promise<StageStatsWire>
  loadWatch?: () => Promise<WatchView>
  pollMs?: number
}) {
  const instance = useId()
  const now = useNow()
  const key = loadStats ? instance : 'live'
  const stats = useQuery({
    queryKey: ['stage-stats', key],
    queryFn: () => (loadStats ?? getStageStats)(),
    refetchInterval: pollMs,
    refetchIntervalInBackground: true,
    retry: false,
  })
  const watch = useQuery({
    queryKey: ['stage-watch', key],
    queryFn: () => (loadWatch ?? (() => getWatchView()))(),
    refetchInterval: pollMs,
    refetchIntervalInBackground: true,
    retry: false,
  })

  // Not `isError`: with no data yet, react-query resets an errored query to pending on every retry, which
  // would blink offline ↔ idle. The newest outcome wins instead.
  const failed = stats.errorUpdatedAt > stats.dataUpdatedAt
  const model = toStageModel({ stats: stats.data, watch: watch.data, failed })

  return (
    <StageView
      {...model}
      now={now}
      joinUrl={joinUrl}
      chainName={chainName}
      updatedAt={stats.dataUpdatedAt || null}
    />
  )
}
