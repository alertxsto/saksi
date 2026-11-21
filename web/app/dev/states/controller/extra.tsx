import type { ReactNode } from 'react'
import type { TxView } from '@/components/ui/TxStepper'
import type { WalletView } from '@/components/ui/WalletGate'
import { BreachView, type CheckState, type DraftState } from '@/app/controller/breach/BreachView'
import { AccessLogView, type LogStatus } from '@/app/controller/log/AccessLog'
import { AgencyPageHead } from '@/components/controller/AgencyKit'
import type { RecentAccess } from '@/lib/data'
import { useNow } from '@/lib/hooks'
import type { Pasal46Fields } from '@/lib/shared/types'

export type ExtraState = { label: string; render: () => ReactNode; wallet?: WalletView }

const noop = () => {}
const AGENCY = 'Disdukcapil Kota Contoh'
const HASH = '0x8f3c2a91d4e07b65a1c9f0e2d3b4a5968776655443322110ffeeddccbbaa9988' as const

// ---- access log -----------------------------------------------------------------------------------

function ago(min: number): string {
  return new Date(Date.UTC(2026, 10, 21, 6, 16) - min * 60_000).toISOString()
}

const ROWS: RecentAccess[] = [
  { id: 'r1', citizenCode: 'K7••QD', eventType: 0, status: 'anchored', txHash: HASH, createdAt: ago(0), legalBasisKey: 'PDP-20-2-e', blockNumber: 7_412_118, logIndex: 3 },
  { id: 'r2', citizenCode: 'M2••8P', eventType: 1, status: 'submitted', txHash: null, createdAt: ago(14), legalBasisKey: 'PDP-20-2-c' },
  { id: 'r3', citizenCode: 'A9••X4', eventType: 3, status: 'anchored', txHash: HASH, createdAt: ago(52), legalBasisKey: 'PDP-20-2-a', blockNumber: 7_411_902, logIndex: 0 },
  { id: 'r4', citizenCode: 'T4••7K', eventType: 2, status: 'failed', txHash: null, createdAt: ago(130), legalBasisKey: 'PDP-20-2-b', failReason: 'the agency declined the signature' },
  { id: 'r5', citizenCode: 'Q1••ZB', eventType: 0, status: 'anchored', txHash: HASH, createdAt: ago(310), legalBasisKey: 'PDP-20-2-e', blockNumber: 7_410_557, logIndex: 1 },
  { id: 'r6', citizenCode: 'H8••3N', eventType: 0, status: 'anchored', txHash: HASH, createdAt: ago(1440), legalBasisKey: 'PDP-20-2-d', blockNumber: 7_405_020, logIndex: 2 },
]

function Log({ status = 'ready', rows = ROWS, open = null }: { status?: LogStatus; rows?: RecentAccess[]; open?: string | null }) {
  return (
    <div>
      <AgencyPageHead title="Access log" description="Every lookup this agency recorded, newest first. Each one is a receipt on the citizen’s phone." />
      <AccessLogView agencyName={AGENCY} status={status} rows={rows} error="The Saksi server did not answer." onRetry={noop} initialOpenId={open} />
    </div>
  )
}

// ---- breach notice --------------------------------------------------------------------------------

const FIELDS: Pasal46Fields = {
  dataAffected: 'Names, NIK and home addresses of 1,240 residents who applied for a new KTP in October.',
  whenAndHow: 'A staff export was left in a public storage bucket on 19 Nov; our engineer found it on 20 Nov at 10:00 WIB.',
  actionsTaken: 'The bucket was closed within 20 minutes, access logs were pulled and the export was deleted.',
  contact: 'PPID Disdukcapil Kota Contoh, ppid@contoh.go.id, 0800-123-4567.',
}
const DRAFT_DONE: DraftState = { status: 'done' }

function Breach({
  hoursAgo,
  check = { status: 'idle' },
  tx = { phase: 'idle' },
  mode = null,
  filled = true,
}: {
  hoursAgo: number | null
  check?: CheckState
  tx?: TxView
  mode?: 'on_time' | 'late' | null
  filled?: boolean
}) {
  // useNow is 0 on the server, so the fixture times only appear after hydration (no mismatch).
  const now = useNow()
  const nowSec = now ? Math.floor(now / 1000) : 0
  const detectedAtSec = hoursAgo !== null && nowSec ? nowSec - Math.round(hoursAgo * 3600) : 0
  const deadline = detectedAtSec ? detectedAtSec + 72 * 3600 : undefined
  return (
    <BreachView
      narrative={filled ? 'Yesterday our engineer found a staff export with resident data in a public storage bucket. We closed it within 20 minutes.' : ''}
      onNarrativeChange={noop}
      draft={filled ? DRAFT_DONE : { status: 'idle' }}
      onDraft={noop}
      fields={filled ? FIELDS : null}
      edited={filled ? { contact: true } : {}}
      onFieldChange={noop}
      detectedAtSec={detectedAtSec}
      onDetectedAtChange={noop}
      affected={filled ? '1240' : ''}
      onAffectedChange={noop}
      check={check.status === 'on_time' || check.status === 'late' ? { ...check, deadlineSec: deadline } : check}
      onCheckWithContract={noop}
      mode={mode}
      tx={tx}
      onAnchor={noop}
      onRecordLate={noop}
      onRetry={noop}
      onReconfirm={noop}
      onReset={noop}
    />
  )
}

/** Access log and breach states. */
export const AGENCY_GALLERY_EXTRA: Record<string, ExtraState> = {
  'log-ready': { label: 'Access log · rows', render: () => <Log /> },
  'log-sheet': { label: 'Access log · receipt open', render: () => <Log open="r1" /> },
  'log-sheet-failed': { label: 'Access log · not sealed receipt', render: () => <Log open="r4" /> },
  'log-loading': { label: 'Access log · loading', render: () => <Log status="loading" rows={[]} /> },
  'log-empty': { label: 'Access log · empty', render: () => <Log rows={[]} /> },
  'log-error': { label: 'Access log · error', render: () => <Log status="error" rows={[]} /> },
  'breach-empty': { label: 'Breach · no detection time', render: () => <Breach hoursAgo={null} filled={false} /> },
  'breach-due': { label: 'Breach · due in 41 h', render: () => <Breach hoursAgo={31} /> },
  'breach-ontime': { label: 'Breach · contract says on time', render: () => <Breach hoursAgo={31} check={{ status: 'on_time' }} /> },
  'breach-late': { label: 'Breach · overdue', render: () => <Breach hoursAgo={80} check={{ status: 'late' }} /> },
  'breach-sealing': { label: 'Breach · sealing', render: () => <Breach hoursAgo={31} check={{ status: 'on_time' }} mode="on_time" tx={{ phase: 'broadcast', txHash: HASH }} /> },
  'breach-sealed': {
    label: 'Breach · sealed on time',
    render: () => <Breach hoursAgo={31} check={{ status: 'on_time' }} mode="on_time" tx={{ phase: 'confirmed', txHash: HASH, blockNumber: 7_412_301 }} />,
  },
  'breach-sealed-late': {
    label: 'Breach · sealed late',
    render: () => <Breach hoursAgo={80} check={{ status: 'late' }} mode="late" tx={{ phase: 'confirmed', txHash: HASH, blockNumber: 7_412_355 }} />,
  },
}
