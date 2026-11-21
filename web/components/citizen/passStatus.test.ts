import { describe, expect, it } from 'vitest'
import { passShortTitle, passStatus, type PassCounts } from './passStatus'

const ready: PassCounts = { state: 'ready', total: 3, matched: 3, checking: 0, anchored: 3, sealing: 0, altered: 0, deleted: 0, watching: true }

describe('passStatus', () => {
  it('stays green with nothing altered or deleted', () => {
    expect(passStatus(ready)).toMatchObject({ verdict: 'ok', title: 'All 3 receipts match the sealed record' })
  })

  it('names altered records as changed after sealing', () => {
    expect(passStatus({ ...ready, altered: 1 })).toMatchObject({ verdict: 'tamper', title: '1 record was changed after sealing' })
    expect(passStatus({ ...ready, altered: 2 }).title).toBe('2 records were changed after sealing')
  })

  it('names a deleted-only tamper as disappeared, not changed', () => {
    expect(passStatus({ ...ready, deleted: 1 })).toMatchObject({ verdict: 'tamper', title: '1 record disappeared from the agency’s database' })
    expect(passStatus({ ...ready, deleted: 2 }).title).toBe('2 records disappeared from the agency’s database')
  })

  it('mentions both when records were changed and deleted', () => {
    expect(passStatus({ ...ready, altered: 1, deleted: 2 })).toMatchObject({ verdict: 'tamper', title: '1 record changed and 2 disappeared after sealing' })
  })

  it('turns the short title red for deleted records too', () => {
    expect(passShortTitle({ ...ready, deleted: 1 })).toBe('Tampering found')
    expect(passShortTitle(ready)).toBe('All 3 match the sealed record')
  })
})
