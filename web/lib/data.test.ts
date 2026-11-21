import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ApiClientError,
  controllerCandidates,
  DEMO_CONTROLLER_IDS,
  explain,
  getProfile,
  getReceipts,
  getWatchView,
  readReceiptFile,
  toBreachDetail,
  toCitizenError,
  toRecentAccess,
  toWatchRows,
  verdictOf,
  watchRef,
  type BreachDetailWire,
  type RecentAccessWire,
} from './data'
import type { ReceiptOpening, WatchRow } from './shared/types'

const hex32 = (c: string) => `0x${c.repeat(64)}` as `0x${string}`

const opening: ReceiptOpening = {
  eventId: '3f2b9c1e-8a4d-4e6f-9b0a-1c2d3e4f5a6b',
  controllerId: hex32('a'),
  controllerName: 'Demo One',
  subjectPseudonym: hex32('b'),
  purposeText: 'Debt collection',
  purposeSalt: hex32('c'),
  legalBasisKey: hex32('d'),
  eventType: 3,
  evidence: { v: 1 },
  txHash: hex32('e'),
  logIndex: 2,
  status: 'anchored',
  createdAt: '2026-11-21T00:00:00.000Z',
}

type Call = { url: string; init?: RequestInit }

/** Replaces fetch with one canned JSON answer and records every request. */
function answer(status: number, body: unknown) {
  const calls: Call[] = []
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    calls.push({ url, init })
    return new Response(body === null ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  })
  return calls
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('explain (POST /api/ai/explain)', () => {
  it('sends only the event id and shows the provider, model and fallback level the server reports', async () => {
    const ai = { provider: 'api.groq.com', model: 'llama-x', fallbackLevel: 'fallback' as const, latencyMs: 812 }
    const calls = answer(200, { text: 'The receipt matches the chain.', ai })
    await expect(explain(opening)).resolves.toEqual({ text: 'The receipt matches the chain.', meta: ai })
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe('/api/ai/explain')
    expect(calls[0].init?.method).toBe('POST')
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ eventId: opening.eventId })
  })
})

describe('citizen session', () => {
  it('turns 401 SESSION_REQUIRED into NO_SESSION so the screen offers to create a profile', async () => {
    answer(401, { error: { code: 'SESSION_REQUIRED', message: 'Create a citizen profile first.' } })
    const error = await getReceipts().catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiClientError)
    expect(toCitizenError(error)).toEqual({ code: 'NO_SESSION', message: 'Create a citizen profile first.' })
    await expect(getProfile()).resolves.toBeNull()
  })

  it('reads the profile from the receipts response', async () => {
    answer(200, { receipts: [opening], pseudonyms: [], profile: { code: 'K7M2QD', displayName: 'Synthetic' } })
    await expect(getProfile()).resolves.toEqual({ code: 'K7M2QD', displayName: 'Synthetic' })
  })

  it('maps rate limits and unreadable error pages to UI error codes', () => {
    expect(toCitizenError(new ApiClientError(429, 'RATE_LIMITED', 'Wait')).code).toBe('RATE_LIMITED')
    expect(toCitizenError(new ApiClientError(0, 'NETWORK', 'Offline')).code).toBe('NETWORK')
    expect(toCitizenError(new ApiClientError(503, 'UNAVAILABLE', 'Down'))).toEqual({ code: 'UNKNOWN', message: 'Down' })
  })
})

describe('verdictOf', () => {
  it('shows MISMATCH as ALTERED and NOT_FOUND as not found on this node', () => {
    expect(verdictOf({ status: 'MATCH' })).toBe('MATCH')
    expect(verdictOf({ status: 'MISMATCH' })).toBe('ALTERED')
    expect(verdictOf({ status: 'NOT_FOUND' })).toBe('NOT FOUND ON THIS NODE')
  })
})

describe('toRecentAccess', () => {
  const wire: RecentAccessWire = {
    id: 'row-1',
    eventType: 0,
    action: 'READ',
    legalBasisKey: 'PDP-20-2-b',
    status: 'failed',
    failReason: 'The journal event does not match the draft.',
    txHash: hex32('1'),
    logIndex: null,
    blockNumber: null,
    subjectCodeHint: 'K7••••',
    createdAt: '2026-11-21T01:00:00.000Z',
  }

  it('keeps the masked code and the server fields, and never invents a purpose', () => {
    const row = toRecentAccess(wire)
    expect(row).toMatchObject({ id: 'row-1', citizenCode: 'K7••••', status: 'failed', failReason: wire.failReason, legalBasisKey: 'PDP-20-2-b' })
    expect('purposeText' in row).toBe(false)
  })

  it('labels rows whose citizen deleted the demo profile', () => {
    expect(toRecentAccess({ ...wire, subjectCodeHint: null }).citizenCode).toBe('(deleted)')
  })
})

describe('toBreachDetail', () => {
  const wire: BreachDetailWire = {
    id: '6b0f6f0e-1d5a-4c55-9d1c-0f2b9c1e8a4d',
    controllerName: 'Demo One',
    title: 'Synthetic breach report',
    detectedAt: 1_763_600_000,
    anchoredAt: 1_763_700_000,
    mode: 'late',
    lateBySec: 3_600,
    hoursUsed: 27.7,
    txHash: hex32('9'),
    status: 'anchored',
    pasal46: { dataAffected: 'a', whenAndHow: 'b', actionsTaken: 'c', contact: 'd' },
    ai: null,
    discoveryAt: 1_763_600_000,
    deadline: 1_763_859_200,
  }

  it('uses the configured contract and does not claim an unchecked notice hash', () => {
    const contract = `0x${'12'.repeat(20)}` as const
    expect(toBreachDetail(wire, contract)).toMatchObject({ contract, reportHash: null, noticeHashMatches: null, affectedCount: null, mode: 'late' })
    expect(toBreachDetail(wire, null).contract).toBeNull()
  })
})

describe('watch rows', () => {
  const row = (over: Partial<WatchRow>): WatchRow => ({
    eventId: '3f2b9c1e-8a4d-4e6f-9b0a-1c2d3e4f5a6b',
    txHash: hex32('f'),
    logIndex: 1,
    controllerName: 'Demo One',
    status: 'MATCH',
    ...over,
  })

  it('builds refs from the event id, or from tx and log index for deleted rows', () => {
    expect(watchRef(row({}))).toBe('R.3F2B9C1E')
    expect(watchRef(row({ eventId: null, txHash: `0xabcdef${'0'.repeat(58)}`, logIndex: 4 }))).toBe('TX.ABCDEF:4')
  })

  it('sets changedAt only when a row status flips between polls, and keeps it afterwards', () => {
    const seen = new Map()
    const [first] = toWatchRows([row({})], seen, 1_000)
    expect(first.changedAt).toBeUndefined()
    const [flipped] = toWatchRows([row({ status: 'ALTERED', field: 'eventType' })], seen, 3_000)
    expect(flipped.changedAt).toBe(3_000)
    const [later] = toWatchRows([row({ status: 'ALTERED', field: 'eventType' })], seen, 4_000)
    expect(later.changedAt).toBe(3_000)
  })

  it('reads the GET /api/watch response (status-keyed stats, no stale flag)', async () => {
    const calls = answer(200, {
      rows: [row({ status: 'NOT_ANCHORED', eventId: null, logIndex: -1 })],
      stats: { MATCH: 0, ALTERED: 0, DELETED: 0, NOT_ANCHORED: 1 },
      blockNumber: 9_000_123,
      checkedAt: '2026-11-21T00:00:00.000Z',
    })
    const view = await getWatchView()
    expect(calls[0].url).toBe('/api/watch')
    expect(view.blockNumber).toBe(9_000_123)
    expect(view.stale).toBe(false)
    expect(view.rows[0]).toMatchObject({ status: 'NOT_ANCHORED', ref: `TX.${'F'.repeat(6)}:-1` })
  })
})

describe('readReceiptFile', () => {
  const file = (value: unknown) => ({ text: async () => JSON.stringify(value) })

  it('reads the file written by downloadReceipt, a wrapped opening, or a bare opening', async () => {
    await expect(readReceiptFile(file({ chainId: 11155111, contractAddress: '0x', opening, instructions: '…' }))).resolves.toEqual(opening)
    await expect(readReceiptFile(file({ kind: 'saksi-receipt', opening }))).resolves.toEqual(opening)
    await expect(readReceiptFile(file(opening))).resolves.toEqual(opening)
  })

  it('rejects files that are not receipts', async () => {
    await expect(readReceiptFile(file({ hello: 'world' }))).resolves.toBeNull()
    await expect(readReceiptFile({ text: async () => 'not json' })).resolves.toBeNull()
  })
})

describe('DEMO_CONTROLLER_IDS', () => {
  it('derives the deployed controller ids from their slugs', () => {
    // Same vector as test/commit.test.ts for ctrl:demo-one.
    expect(DEMO_CONTROLLER_IDS[0]).toBe('0x81d37ea3558b4d7aaa6fe7db776b0bcd7b6c8cc9a7cb87b6948b92e10fa01246')
    expect(DEMO_CONTROLLER_IDS).toHaveLength(3)
  })
})

describe('controllerCandidates', () => {
  const id = (n: number) => `0x${n.toString(16).padStart(64, '0')}` as const
  const log = (n: number, blockNumber: bigint, logIndex = 0) => ({ controllerId: id(n), blockNumber, logIndex })

  it('puts the newest active registration first, then the static fallback ids', () => {
    const ids = controllerCandidates([log(1, 100n), log(2, 200n)], [])
    expect(ids.slice(0, 2)).toEqual([id(2), id(1)])
    expect(ids.slice(2)).toEqual([...DEMO_CONTROLLER_IDS])
  })

  it('orders registrations in one block by log index', () => {
    expect(controllerCandidates([log(1, 100n, 5), log(2, 100n, 3)], [], [])).toEqual([id(1), id(2)])
  })

  it('drops an id revoked after its newest registration but keeps one re-registered after a revocation', () => {
    expect(controllerCandidates([log(1, 100n), log(2, 150n)], [log(2, 160n)], [])).toEqual([id(1)])
    expect(controllerCandidates([log(1, 100n), log(1, 300n)], [log(1, 200n)], [])).toEqual([id(1)])
    expect(controllerCandidates([log(1, 100n, 1)], [log(1, 100n, 2)], [])).toEqual([])
  })

  it('falls back to the static ids when the log read failed or found nothing', () => {
    expect(controllerCandidates(null, [])).toEqual([...DEMO_CONTROLLER_IDS])
    expect(controllerCandidates([], [])).toEqual([...DEMO_CONTROLLER_IDS])
  })

  it('does not repeat an id that is both registered and a fallback id, and ignores hex case', () => {
    const demoOne = DEMO_CONTROLLER_IDS[0]
    const upper = `0x${demoOne.slice(2).toUpperCase()}` as const
    const ids = controllerCandidates([{ controllerId: upper, blockNumber: 1n, logIndex: 0 }, log(9, 2n)], [])
    expect(ids[0]).toBe(id(9))
    expect(ids[1]).toBe(demoOne)
    expect(ids.filter((x) => x === demoOne)).toHaveLength(1)
  })
})

describe('toBreachDraft', () => {
  it('keeps only the four Art. 46 parts so breach prepare accepts them', async () => {
    const { toBreachDraft } = await import('./data')
    const fields = { dataAffected: 'a', whenAndHow: 'b', actionsTaken: 'c', contact: 'd', detectedAtGuess: '08:00' }
    const draft = toBreachDraft({ fields, ai: { provider: 'p', model: 'm', fallbackLevel: 'primary', latencyMs: 1 }, aiRunId: 'x' } as never)
    expect(Object.keys(draft.fields).sort()).toEqual(['actionsTaken', 'contact', 'dataAffected', 'whenAndHow'])
  })
})
