import { describe, expect, it } from 'vitest'
import {
  alteredFields,
  checkable,
  checkDue,
  contentKey,
  controllerAltered,
  hiddenReceipts,
  IDLE,
  receiptHeadline,
  recordKind,
  receiptKind,
  RETRY_ERROR_MS,
  RETRY_NOT_FOUND_MS,
  sealedEventType,
  verdictKind,
  verdictNote,
  type ReceiptCheck,
} from './receipt-state'
import type { ReceiptOpening, VerifyResult } from './shared/types'

const hex32 = (c: string) => `0x${c.repeat(64)}` as `0x${string}`

// The tamper demo: the chain sealed SHARE_THIRD_PARTY (3); the database row was edited to READ (0).
const tampered: ReceiptOpening = {
  eventId: '3f2b9c1e-8a4d-4e6f-9b0a-1c2d3e4f5a6b',
  controllerId: hex32('a'),
  controllerName: 'Demo Spare (fictional)',
  subjectPseudonym: hex32('b'),
  purposeText: 'Debt collection',
  purposeSalt: hex32('c'),
  legalBasisKey: hex32('d'),
  eventType: 0,
  evidence: { v: 1 },
  txHash: hex32('e'),
  logIndex: 2,
  status: 'anchored',
  createdAt: '2026-11-21T00:00:00.000Z',
}

const base = { elapsedMs: 900, rpc: 'ethereum-sepolia-rpc.publicnode.com' }
const MATCH: VerifyResult = { status: 'MATCH', mismatches: [], blockNumber: 12181700, confirmations: 40, ...base }
const ALTERED: VerifyResult = {
  status: 'MISMATCH',
  mismatches: [{ field: 'eventType', db: 'READ', chain: 'SHARE_THIRD_PARTY' }],
  ...base,
}
const PURPOSE_ALTERED: VerifyResult = {
  status: 'MISMATCH',
  mismatches: [{ field: 'purpose', db: hex32('1'), chain: hex32('2') }],
  ...base,
}
const NOT_FOUND: VerifyResult = { status: 'NOT_FOUND', mismatches: [], ...base }
const done = (result: VerifyResult, at = 1_000): ReceiptCheck => ({ phase: 'done', result, at })

describe('receiptKind: one badge for database claim + chain verdict', () => {
  it('shows the database claim before any check (the same mapping the controller-side badge uses)', () => {
    for (const status of ['pending', 'submitted', 'anchored', 'failed'] as const) {
      expect(receiptKind({ status }, IDLE)).toBe(recordKind(status))
    }
    expect(receiptKind({ status: 'anchored' }, IDLE)).toBe('RECORDED')
    expect(receiptKind({ status: 'pending' }, IDLE)).toBe('ON_CHAIN')
    expect(receiptKind({ status: 'submitted' }, IDLE)).toBe('ON_CHAIN')
    expect(receiptKind({ status: 'failed' }, IDLE)).toBe('FAILED')
  })

  it('never keeps the green RECORDED badge once the chain says ALTERED', () => {
    expect(receiptKind(tampered, done(ALTERED))).toBe('ALTERED')
    expect(receiptKind(tampered, done(PURPOSE_ALTERED))).toBe('ALTERED')
  })

  it('MATCH stays green; a running check shows CHECKING', () => {
    expect(receiptKind(tampered, done(MATCH))).toBe('MATCH')
    expect(receiptKind(tampered, { phase: 'running' })).toBe('CHECKING')
  })

  it('NOT_FOUND replaces RECORDED only; pending and failed receipts are expected to be missing', () => {
    expect(receiptKind({ status: 'anchored' }, done(NOT_FOUND))).toBe('NOT_FOUND')
    expect(receiptKind({ status: 'pending' }, done(NOT_FOUND))).toBe('ON_CHAIN')
    expect(receiptKind({ status: 'failed' }, done(NOT_FOUND))).toBe('FAILED')
  })

  it('a failed check decides nothing', () => {
    expect(receiptKind({ status: 'anchored' }, { phase: 'error', error: 'timeout', at: 1 })).toBe('RECORDED')
  })
})

describe('verdictKind (receipts opened from an untrusted link)', () => {
  it('has no badge before this browser checked, then follows the chain only', () => {
    expect(verdictKind(IDLE)).toBeNull()
    expect(verdictKind({ phase: 'error', error: 'x', at: 1 })).toBeNull()
    expect(verdictKind({ phase: 'running' })).toBe('CHECKING')
    expect(verdictKind(done(MATCH))).toBe('MATCH')
    expect(verdictKind(done(ALTERED))).toBe('ALTERED')
    expect(verdictKind(done(NOT_FOUND))).toBe('NOT_FOUND')
  })
})

describe('receiptHeadline', () => {
  it('uses the database event type before a check and on MATCH', () => {
    for (const check of [IDLE, done(MATCH), { phase: 'running' } as const]) {
      expect(receiptHeadline(tampered, check)).toMatchObject({
        who: 'Demo Spare',
        eventType: 0,
        act: 'read your data',
        source: 'record',
        claimed: null,
      })
    }
  })

  it('on ALTERED event type, states what the chain sealed and names the database version as the claim', () => {
    expect(receiptHeadline(tampered, done(ALTERED))).toEqual({
      who: 'Demo Spare',
      eventType: 3,
      act: 'shared your data with a third party',
      source: 'chain',
      claimed: 'read your data',
      kind: 'ALTERED',
    })
  })

  it('on ALTERED purpose (chain holds only a hash), keeps the act but the kind is ALTERED', () => {
    expect(receiptHeadline(tampered, done(PURPOSE_ALTERED))).toMatchObject({ source: 'record', claimed: null, kind: 'ALTERED' })
  })

  it('ignores an unreadable sealed event type instead of guessing', () => {
    const odd: VerifyResult = { ...ALTERED, mismatches: [{ field: 'eventType', db: 'READ', chain: '9' }] }
    expect(sealedEventType(done(odd))).toBeNull()
    expect(receiptHeadline(tampered, done(odd))).toMatchObject({ source: 'record', act: 'read your data', kind: 'ALTERED' })
  })
})

describe('ledger flags', () => {
  it('lists altered fields only for an ALTERED verdict', () => {
    expect([...alteredFields(done(ALTERED))]).toEqual(['eventType'])
    expect(alteredFields(done(MATCH)).size).toBe(0)
    expect(alteredFields(done(NOT_FOUND)).size).toBe(0)
    expect(alteredFields(IDLE).size).toBe(0)
    expect(sealedEventType(done(ALTERED))).toBe(3)
    expect(sealedEventType(done(MATCH))).toBeNull()
  })

  it('flags WHO only when the sealed controller id differs from the database one', () => {
    const wrongController: VerifyResult = {
      ...ALTERED,
      mismatches: [{ field: 'contract', db: tampered.controllerId.toUpperCase().replace('0X', '0x'), chain: hex32('f') }],
    }
    const wrongTarget: VerifyResult = { ...ALTERED, mismatches: [{ field: 'contract', db: hex32('9'), chain: 'missing log' }] }
    expect(controllerAltered(tampered, done(wrongController))).toBe(true)
    expect(controllerAltered(tampered, done(wrongTarget))).toBe(false)
    expect(controllerAltered(tampered, done(MATCH))).toBe(false)
  })

  it('has a note for every verdict and none before one', () => {
    expect(verdictNote('MATCH')).toMatch(/matches the chain/i)
    expect(verdictNote('ALTERED')).toMatch(/no longer matches/i)
    expect(verdictNote('NOT_FOUND')).toMatch(/not proof of tampering/i)
    expect(verdictNote('CHECKING')).toMatch(/checking/i)
    expect(verdictNote('RECORDED')).toBeNull()
    expect(verdictNote('ON_CHAIN')).toBeNull()
    expect(verdictNote('FAILED')).toBeNull()
  })
})

describe('background checks', () => {
  it('a database edit gives the receipt a new content key, so an old MATCH no longer applies', () => {
    const original = { ...tampered, eventType: 3 as const }
    expect(contentKey(original)).not.toBe(contentKey(tampered))
    expect(contentKey({ ...tampered, status: 'anchored', createdAt: 'later' })).toBe(contentKey(tampered))
    expect(contentKey({ ...tampered, purposeText: 'Marketing' })).not.toBe(contentKey(tampered))
    expect(contentKey({ ...tampered, evidence: { v: 2 } })).not.toBe(contentKey(tampered))
  })

  it('checks only sealed receipts that carry a transaction', () => {
    expect(checkable(tampered)).toBe(true)
    expect(checkable({ ...tampered, status: 'submitted' })).toBe(false)
    expect(checkable({ ...tampered, txHash: null })).toBe(false)
    expect(checkable({ ...tampered, logIndex: null })).toBe(false)
  })

  it('MATCH and ALTERED are final; NOT_FOUND and errors retry after a pause', () => {
    const t = 50_000
    expect(checkDue(IDLE, t)).toBe(true)
    expect(checkDue({ phase: 'running' }, t)).toBe(false)
    expect(checkDue(done(MATCH, 0), t)).toBe(false)
    expect(checkDue(done(ALTERED, 0), t)).toBe(false)
    expect(checkDue(done(NOT_FOUND, t), t + RETRY_NOT_FOUND_MS - 1)).toBe(false)
    expect(checkDue(done(NOT_FOUND, t), t + RETRY_NOT_FOUND_MS)).toBe(true)
    expect(checkDue({ phase: 'error', error: 'x', at: t }, t + RETRY_ERROR_MS - 1)).toBe(false)
    expect(checkDue({ phase: 'error', error: 'x', at: t }, t + RETRY_ERROR_MS)).toBe(true)
  })
})

describe('hiddenReceipts (sealed on chain, missing from the company list)', () => {
  const deleted = { txHash: hex32('7'), logIndex: 0 }
  const key = `${deleted.txHash}:0`

  it('reports a missing receipt only after two scans in a row', () => {
    const first = hiddenReceipts([], [deleted], [tampered])
    expect(first).toEqual({ candidates: [key], confirmed: [] })
    expect(hiddenReceipts(first.candidates, [deleted], [tampered]).confirmed).toEqual([key])
  })

  it('never reports a log whose transaction a shown receipt carries (still confirming, or another log index)', () => {
    const own = { txHash: tampered.txHash!.toUpperCase().replace('0X', '0x'), logIndex: 5 }
    expect(hiddenReceipts([`${tampered.txHash}:5`], [own], [tampered])).toEqual({ candidates: [], confirmed: [] })
  })

  it('clears once the receipt is shown again (restore)', () => {
    const restored = { ...tampered, txHash: deleted.txHash, logIndex: 0 }
    expect(hiddenReceipts([key], [deleted], [restored]).confirmed).toEqual([])
  })
})
