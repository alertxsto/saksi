import type { Metadata } from 'next'
import { TamperProof } from '@/app/operator/OperatorConsole'
import type { TamperReport } from '@/lib/data'

export const metadata: Metadata = { title: 'Operator states', robots: { index: false } }

// Fixture for the design gallery only (404 in production): the shape POST /api/demo/tamper returns after an edit.
// The statement text is what lib/server/tamper.ts statementText() produces for an edit (see test/demo-console.test.ts).
const EDIT: TamperReport = {
  action: 'edit',
  eventId: '3f1c2a4e-8b7d-4c1a-9e2f-0a1b2c3d4e5f',
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
    { name: 'id', value: '3f1c2a4e-8b7d-4c1a-9e2f-0a1b2c3d4e5f' },
  ],
  changes: [{ field: 'event_type', before: '3 · Shared with third party', after: '0 · Read' }],
  rowHash: {
    before: '0x5d1f0c7a4be0a4f7e2b8f1d4c6a39e0b7d2c5f8a1e4b7d0c3f6a9e2b5d8c1f47',
    after: '0x9b2e4d6f8a0c2e4f6a8b0d2f4a6c8e0a2c4e6f8b0d2f4a6c8e0b2d4f6a8c0e21',
  },
  log: { id: 'c0ffee00-1234-4abc-9def-001122334455', at: '2026-11-22T01:00:00.000Z' },
}

export default function OperatorStatesPage() {
  return (
    <main className="mx-auto flex max-w-[1200px] flex-col gap-6 px-4 py-10 md:px-8">
      <p className="label text-[12px] text-ink-2">/dev · operator · after an edit (fixture)</p>
      <div className="max-w-[860px]">
        <TamperProof report={EDIT} />
      </div>
    </main>
  )
}
