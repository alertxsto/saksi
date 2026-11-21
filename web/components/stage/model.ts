// Pure model for the stage screen: wire data (GET /api/stats + GET /api/watch) → what StageView shows.
// No React, no fetch, so it is unit-tested and shared by the live container and the /dev gallery.
import type { StageStatsWire, WatchView } from '@/lib/data'
import type { EventTypeCode, RecordStatus, WatchRow } from '@/lib/shared/types'

export type StageState = 'idle' | 'live' | 'alert' | 'offline'

export type StageFeedStatus = RecordStatus | 'altered'

export type StageFeedRow = {
  id: string
  controllerName: string
  /** null for an altered row that is no longer among the recent receipts. */
  eventType: EventTypeCode | null
  citizenMasked: string | null
  /** ms epoch shown as "8s ago"; null when unknown. */
  at: number | null
  status: StageFeedStatus
}

export type StageChange = {
  controllerName: string
  /** Plain-English field name, e.g. "What they did". */
  field: string
  db: string
  chain: string
}

export type StageCounts = { citizens: number; receipts: number; lastSealAt: number | null }
export type StageWatchCounts = { match: number; altered: number; deleted: number }

export type StageModel = {
  state: StageState
  counts: StageCounts | null
  feed: StageFeedRow[]
  watch: StageWatchCounts | null
  change: StageChange | null
  blockNumber: number | null
}

/** Rows the feed renders: 5 visible + 1 that slides out under the bottom fade. */
export const FEED_ROWS = 6

const FIELD_LABELS: Record<string, string> = {
  eventType: 'What they did',
  legalBasis: 'Legal basis',
  purpose: 'Why',
  evidence: 'Evidence',
  pseudonym: 'Pseudonym',
  contract: 'Contract',
}

const SHORT_EVENT = ['READ', 'UPDATE', 'EXPORT', 'SHARE'] as const

/** Short event label that fits the feed column ("SHARE" for SHARE_THIRD_PARTY). */
export function eventLabel(code: EventTypeCode | null): string {
  return code === null ? '' : (SHORT_EVENT[code] ?? '')
}

/** Watch values arrive as names ("SHARE_THIRD_PARTY") or free text; keep them short enough for one line. */
function shortValue(v: string | undefined): string {
  const s = (v ?? '—').replace('SHARE_THIRD_PARTY', 'SHARE').trim()
  return s.length > 26 ? `${s.slice(0, 25)}…` : s
}

/** Alert always wins; then a failed last fetch; then idle until the first sealed receipt. */
export function deriveStageState(input: { failed: boolean; receipts: number | null; altered: number }): StageState {
  if (input.altered > 0) return 'alert'
  if (input.failed) return 'offline'
  return input.receipts ? 'live' : 'idle'
}

export function countWatch(rows: Pick<WatchRow, 'status'>[]): StageWatchCounts {
  const n = (s: WatchRow['status']) => rows.filter((r) => r.status === s).length
  return { match: n('MATCH'), altered: n('ALTERED'), deleted: n('DELETED') }
}

/**
 * Builds the stage model. ALTERED Watch rows rise to the top of the feed (matched to a recent receipt by
 * id when possible); the rest is newest first.
 */
export function toStageModel(input: {
  stats: StageStatsWire | undefined
  watch: WatchView | undefined
  /** true when the last /api/stats request failed. */
  failed: boolean
}): StageModel {
  const { stats, watch, failed } = input
  const watchRows = watch?.rows ?? []
  const counts = watch ? countWatch(watchRows) : null
  const altered = watchRows.filter((r) => r.status === 'ALTERED')
  const alteredIds = new Set(altered.map((r) => r.eventId).filter(Boolean))

  const recent = (stats?.recent ?? [])
    .map<StageFeedRow>((r) => ({
      id: r.id,
      controllerName: r.controllerName,
      eventType: r.eventType,
      citizenMasked: r.citizenMasked,
      at: Date.parse(r.createdAt),
      status: alteredIds.has(r.id) ? 'altered' : r.status,
    }))
    .sort((a, b) => (b.at ?? 0) - (a.at ?? 0))

  const top: StageFeedRow[] = altered.map((w) => {
    const hit = recent.find((r) => r.id === w.eventId)
    return (
      hit ?? {
        id: w.eventId ?? w.ref,
        controllerName: w.controllerName,
        eventType: null,
        citizenMasked: null,
        at: w.changedAt ?? null,
        status: 'altered' as const,
      }
    )
  })
  const topIds = new Set(top.map((r) => r.id))
  const feed = [...top, ...recent.filter((r) => !topIds.has(r.id))].slice(0, FEED_ROWS)

  const first = altered[0]
  const change: StageChange | null = first
    ? {
        controllerName: first.controllerName,
        field: FIELD_LABELS[first.field ?? ''] ?? first.field ?? 'A sealed field',
        db: shortValue(first.dbValue),
        chain: shortValue(first.chainValue),
      }
    : null

  return {
    state: deriveStageState({ failed, receipts: stats?.receipts ?? null, altered: altered.length }),
    counts: stats
      ? { citizens: stats.citizens, receipts: stats.receipts, lastSealAt: stats.lastSealAt ? Date.parse(stats.lastSealAt) : null }
      : null,
    feed,
    watch: counts,
    change,
    blockNumber: watch?.blockNumber ?? null,
  }
}

/** "8s" / "4m" / "2h" / "3d"; the screen adds "ago". */
export function ageShort(at: number, now: number): string {
  const s = Math.max(0, Math.floor((now - at) / 1000))
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86_400) return `${Math.floor(s / 3600)}h`
  return `${Math.floor(s / 86_400)}d`
}

/** "saksi.example/citizen" from "https://saksi.example/citizen". */
export function shortUrl(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/\/+$/, '')
}
