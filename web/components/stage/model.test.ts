import { describe, expect, it } from 'vitest'
import type { StageStatsWire, WatchView } from '@/lib/data'
import { ageShort, countWatch, deriveStageState, eventLabel, shortUrl, toStageModel } from './model'

const NOW = Date.UTC(2026, 10, 21, 7, 3)
const iso = (agoSec: number) => new Date(NOW - agoSec * 1000).toISOString()

const stats: StageStatsWire = {
  citizens: 4,
  receipts: 2,
  lastSealAt: iso(12),
  recent: [
    { id: 'a', controllerName: 'Demo One', eventType: 2, citizenMasked: 'JV••••', createdAt: iso(40), status: 'anchored' },
    { id: 'b', controllerName: 'Demo Two', eventType: 0, citizenMasked: '7K••••', createdAt: iso(8), status: 'submitted' },
    { id: 'c', controllerName: 'Demo One', eventType: 3, citizenMasked: 'QF••••', createdAt: iso(20), status: 'anchored' },
  ],
}
const watch = (rows: WatchView['rows']): WatchView => ({ rows, blockNumber: 7_124_544, stale: false })
const row = (eventId: string | null, status: WatchView['rows'][number]['status'], extra = {}) => ({
  ref: `R.${eventId ?? 'x'}`,
  eventId,
  txHash: `0x${'1'.repeat(64)}` as const,
  logIndex: 0,
  controllerName: 'Demo One',
  status,
  ...extra,
})

describe('deriveStageState', () => {
  it('is idle before the first sealed receipt, live after', () => {
    expect(deriveStageState({ failed: false, receipts: null, altered: 0 })).toBe('idle')
    expect(deriveStageState({ failed: false, receipts: 0, altered: 0 })).toBe('idle')
    expect(deriveStageState({ failed: false, receipts: 3, altered: 0 })).toBe('live')
  })
  it('is offline when the last stats call failed', () => {
    expect(deriveStageState({ failed: true, receipts: 3, altered: 0 })).toBe('offline')
  })
  it('alert always wins, even offline or idle', () => {
    expect(deriveStageState({ failed: true, receipts: 3, altered: 1 })).toBe('alert')
    expect(deriveStageState({ failed: false, receipts: 0, altered: 2 })).toBe('alert')
  })
})

describe('toStageModel', () => {
  it('sorts the feed newest first and keeps counts + block', () => {
    const m = toStageModel({ stats, watch: watch([row('a', 'MATCH'), row('c', 'MATCH'), row(null, 'DELETED')]), failed: false })
    expect(m.state).toBe('live')
    expect(m.feed.map((r) => r.id)).toEqual(['b', 'c', 'a'])
    expect(m.watch).toEqual({ match: 2, altered: 0, deleted: 1 })
    expect(m.counts).toEqual({ citizens: 4, receipts: 2, lastSealAt: NOW - 12_000 })
    expect(m.blockNumber).toBe(7_124_544)
    expect(m.change).toBeNull()
  })

  it('lifts the ALTERED row to the top and spells out the change', () => {
    const w = watch([row('a', 'ALTERED', { field: 'eventType', dbValue: 'READ', chainValue: 'SHARE_THIRD_PARTY' }), row('c', 'MATCH')])
    const m = toStageModel({ stats, watch: w, failed: false })
    expect(m.state).toBe('alert')
    expect(m.feed[0]).toMatchObject({ id: 'a', status: 'altered' })
    expect(m.feed).toHaveLength(3)
    expect(m.change).toEqual({ controllerName: 'Demo One', field: 'What they did', db: 'READ', chain: 'SHARE' })
  })

  it('shows an ALTERED row that is no longer among the recent receipts', () => {
    const w = watch([row('old', 'ALTERED', { field: 'purpose', changedAt: NOW - 5_000 })])
    const m = toStageModel({ stats, watch: w, failed: false })
    expect(m.feed[0]).toMatchObject({ id: 'old', eventType: null, citizenMasked: null, at: NOW - 5_000, status: 'altered' })
    expect(m.change?.field).toBe('Why')
  })

  it('keeps the last data while offline; no data yet = nulls', () => {
    expect(toStageModel({ stats, watch: undefined, failed: true })).toMatchObject({ state: 'offline', watch: null, blockNumber: null })
    expect(toStageModel({ stats: undefined, watch: undefined, failed: false })).toMatchObject({ state: 'idle', counts: null, feed: [] })
  })
})

describe('helpers', () => {
  it('formats ages, labels and URLs', () => {
    expect(ageShort(NOW - 8_000, NOW)).toBe('8s')
    expect(ageShort(NOW - 125_000, NOW)).toBe('2m')
    expect(ageShort(NOW + 3_000, NOW)).toBe('0s')
    expect(eventLabel(3)).toBe('SHARE')
    expect(eventLabel(null)).toBe('')
    expect(shortUrl('https://saksi.example/citizen/')).toBe('saksi.example/citizen')
    expect(countWatch([{ status: 'NOT_ANCHORED' }, { status: 'ALTERED' }])).toEqual({ match: 0, altered: 1, deleted: 0 })
  })
})
