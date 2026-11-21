'use client'

import { useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { AgencyPageHead } from '@/components/controller/AgencyKit'
import { AppHeader } from '@/components/ui/AppHeader'
import { OperatorRoomView, RoomSteps, TokenGateView, type RoomData } from '@/app/operator/OperatorRoom'
import type { DemoReceipt, ServiceStatus, TamperAction, TamperReport, WatchSummary } from '@/lib/data'
import { fakeHex } from '@/lib/mock'
import '@/app/controller/agency.css'

// Fixtures for the design gallery only (404 in production). The edit statement is what lib/server/tamper.ts
// statementText() produces (see test/demo-console.test.ts).
const ID = '3f1c2a4e-8b7d-4c1a-9e2f-0a1b2c3d4e5f'
// Fixed base time (22 Nov 2026 01:30 WIB) so server and client render the same text.
const ago = (min: number) => new Date(1_795_199_400_000 - min * 60_000).toISOString()
const row = (id: string, name: string, eventType: 0 | 3, min: number, state: DemoReceipt['state'] = 'intact'): DemoReceipt => ({
  id,
  controllerName: name,
  eventType,
  createdAt: ago(min),
  txHash: fakeHex(`op:${id}`),
  logIndex: 0,
  blockNumber: 7_123_242,
  status: 'anchored',
  state,
  restorable: state !== 'intact',
  editable: state === 'intact' && eventType === 3,
})
const ROWS = (state: DemoReceipt['state']): DemoReceipt[] => [
  row(ID, 'Disdukcapil Kota Contoh (fiktif)', 3, 4, state),
  row('7a2b9c1d-0000-4000-8000-000000000002', 'RSUD Contoh (fiktif)', 0, 26),
  row('9c3d4e5f-0000-4000-8000-000000000003', 'Contoh Lending Co. (fiktif)', 3, 61),
  row('b4e5f6a7-0000-4000-8000-000000000004', 'Bank Contoh (fiktif)', 0, 180),
]
const EDIT: TamperReport = {
  action: 'edit',
  eventId: ID,
  statement: [
    'with changed as (',
    'update access_events a set event_type = $1',
    'where id = $2::uuid',
    'and to_jsonb(a) = $3::jsonb',
    'returning id )',
    'insert into tamper_log (target_table, target_id, action, before_snapshot_enc, before_hash, after_hash)',
    'select $4, id, $5::tamper_action, $6, $7, $8 from changed',
    'returning id, target_id, before_hash, after_hash, at',
  ].join('\n'),
  params: [
    { name: 'event_type', value: '0 · Read' },
    { name: 'id', value: ID },
  ],
  changes: [{ field: 'event_type', before: '3 · Shared with third party', after: '0 · Read' }],
  rowHash: { before: fakeHex('before'), after: fakeHex('after') },
  log: { id: 'c0ffee00-1234-4abc-9def-001122334455', at: '2026-11-22T01:00:00.000Z' },
}
const DELETE: TamperReport = {
  ...EDIT,
  action: 'delete',
  statement: [
    'with gone as (',
    'delete from access_events a where id = $1::uuid',
    'and to_jsonb(a) = $2::jsonb',
    'returning id )',
    'insert into tamper_log (target_table, target_id, action, before_snapshot_enc, before_hash, after_hash)',
    'select $3, id, $4::tamper_action, $5, $6, null from gone',
    'returning id, target_id, before_hash, after_hash, at',
  ].join('\n'),
  params: [{ name: 'id', value: ID }],
  changes: [{ field: 'row', before: 'present', after: 'deleted' }],
  rowHash: { before: fakeHex('before'), after: null },
}
const RESTORE: TamperReport = { ...EDIT, action: 'restore', changes: [{ field: 'event_type', before: '0 · Read', after: '3 · Shared with third party' }] }
const WATCH = (altered: number, deleted: number): WatchSummary => ({
  stats: { MATCH: 11 - altered - deleted, ALTERED: altered, DELETED: deleted, NOT_ANCHORED: 1 },
  blockNumber: 7_123_300,
  verdicts: new Map(),
})
const STATUS: ServiceStatus = {
  rpc: [
    { name: 'primary', ok: true, ms: 182, block: 7_123_300 },
    { name: 'backup', ok: true, ms: 240, block: 7_123_300 },
  ],
  db: { ok: true, ms: 12 },
  ai: { ok: true, ms: 640, model: 'claude-haiku' },
  contracts: { journal: fakeHex('j', 20), breach: fakeHex('b', 20), registry: fakeHex('r', 20) },
  configProblems: [],
}
const base = (over: Partial<RoomData>): RoomData => ({
  rows: ROWS('intact'),
  rowsState: 'ready',
  watch: WATCH(0, 0),
  watchError: false,
  status: STATUS,
  statusPending: false,
  statusFetching: false,
  statusError: null,
  report: null,
  busy: null,
  ...over,
})
const STATES: Record<string, RoomData | 'gate'> = {
  gate: 'gate',
  ready: base({}),
  loading: base({ rows: [], rowsState: 'loading', watch: undefined, status: undefined, statusPending: true }),
  empty: base({ rows: [] }),
  running: base({ busy: { id: ID, action: 'edit' } }),
  edited: base({ rows: ROWS('edited'), report: EDIT, watch: WATCH(1, 0) }),
  deleted: base({ rows: ROWS('deleted'), report: DELETE, watch: WATCH(0, 1) }),
  restored: base({ report: RESTORE }),
}

/** Click-through: actions resolve after 700 ms with the matching fixture, so the motion can be filmed. */
function Interactive({ initial }: { initial: RoomData }) {
  const [data, setData] = useState(initial)
  const onAction = (id: string, action: TamperAction) => {
    setData((d) => ({ ...d, busy: { id, action } }))
    setTimeout(() => {
      const report = action === 'edit' ? EDIT : action === 'delete' ? DELETE : RESTORE
      const state = action === 'edit' ? 'edited' : action === 'delete' ? 'deleted' : 'intact'
      setData((d) => ({ ...d, busy: null, report, rows: ROWS(state), watch: WATCH(state === 'edited' ? 1 : 0, state === 'deleted' ? 1 : 0) }))
    }, 700)
  }
  return <OperatorRoomView data={data} verdictOf={() => undefined} onAction={onAction} onRefresh={() => {}} onRecheck={() => {}} />
}

/** /dev/states/operator?s=gate|ready|loading|empty|running|edited|deleted|restored */
export function OperatorGallery() {
  const s = useSearchParams().get('s') ?? 'ready'
  const st = STATES[s] ?? STATES.ready
  return (
    <div className="ag-root min-h-dvh bg-paper">
      <AppHeader actor="operator" identity="Presenter · synthetic data" />
      <main className="px-4 pb-20 pt-6 md:px-8 md:pt-10">
        <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-6">
          <AgencyPageHead
            title="Evidence room"
            description="Change a sealed record in the agency’s database, the way a careless or dishonest insider could. The citizen’s phone checks it against the public ledger and turns red."
          />
          <RoomSteps />
          {st === 'gate' ? (
            <TokenGateView onUnlock={async () => 'That token was rejected. Check the admin token on the server.'} />
          ) : (
            <Interactive key={s} initial={st} />
          )}
        </div>
      </main>
    </div>
  )
}
