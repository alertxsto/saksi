'use client'

// Every state of the "Report to the regulator" component (components/citizen/ReportAccess.tsx), forced through props.
// Mock sends only (lib/mock.ts); the component is mounted on the receipt detail by its owner.
import type { ReactNode } from 'react'
import { ReportAccess } from '@/components/citizen/ReportAccess'
import type { ReportInput } from '@/lib/data'
import { mockSendReport } from '@/lib/mock'

const EVENT = '8d1f0c2e-4a6b-4c8d-9e0f-1a2b3c4d5e01'
const RECEIPT = {
  id: '8d1f0c2e-4a6b-4c8d-9e0f-1a2b3c4d5e01',
  status: 'open' as const,
  reason: 'altered' as const,
  serverVerdict: 'ALTERED' as const,
  createdAt: '2026-11-22T02:30:00.000Z',
}
const ok = (input: ReportInput) => mockSendReport(input.reason, 'ok')
const duplicate = (input: ReportInput) => mockSendReport(input.reason, 'duplicate')
const hang = () => new Promise<never>(() => {})

const STATES: { name: string; node: ReactNode }[] = [
  { name: 'Idle · row on the receipt', node: <ReportAccess eventId={EVENT} verdict="match" send={ok} /> },
  { name: 'Open · after a MATCH, no reason picked', node: <ReportAccess eventId={EVENT} verdict="match" send={ok} initial={{ phase: 'open' }} /> },
  {
    name: 'Open · after ALTERED, reason preselected, note',
    node: <ReportAccess eventId={EVENT} verdict="altered" send={ok} initial={{ phase: 'open', note: 'My phone turned red on this one this morning.' }} />,
  },
  { name: 'Sending', node: <ReportAccess eventId={EVENT} verdict="altered" send={hang} initial={{ phase: 'sending', reason: 'altered' }} /> },
  {
    name: 'Error',
    node: (
      <ReportAccess
        eventId={EVENT}
        verdict="match"
        send={ok}
        initial={{ phase: 'error', reason: 'not_me', error: 'Could not reach the Saksi server. Check your connection.' }}
      />
    ),
  },
  { name: 'Sent', node: <ReportAccess eventId={EVENT} verdict="altered" send={ok} initial={{ phase: 'sent', receipt: RECEIPT }} /> },
  { name: 'Already sent', node: <ReportAccess eventId={EVENT} verdict="match" send={duplicate} initial={{ phase: 'already' }} /> },
]

/** `only` renders one state on its own, for 390 px screenshots. */
export function ReportGallery({ only }: { only?: number }) {
  const list = only !== undefined && STATES[only] ? [STATES[only]] : STATES
  return (
    <main className="min-h-dvh bg-paper px-4 py-8 md:px-10">
      {only === undefined ? <h1 className="mb-8 text-[28px] font-semibold tracking-[-0.02em] text-ink">Report to the regulator · states</h1> : null}
      <div className="flex flex-wrap items-start gap-8">
        {list.map((s) => (
          <figure key={s.name} className="flex w-full max-w-[390px] flex-col gap-3">
            <figcaption className="border-b border-line pb-2 text-[13px] font-medium text-ink-2">{s.name}</figcaption>
            {s.node}
          </figure>
        ))}
      </div>
    </main>
  )
}
