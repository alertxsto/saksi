'use client'

// Receipt Stub, ticket half: every receipt-detail and profile state, one per URL (?s=…), full screen in the
// real CitizenShell. Below 1024 px it is the phone layout; at ≥ 1024 the ticket sits in the laptop pane.
import Link from 'next/link'
import type { ReactNode } from 'react'
import { CitizenShell } from '@/app/citizen/CitizenShell'
import { ReceiptListView } from '@/app/citizen/CitizenHome'
import { ProfileScreenView } from '@/app/citizen/profile/ProfileView'
import { ReceiptDetailView, ReceiptMissingView, type DetailAiState, type DetailVerifyState } from '@/app/citizen/receipt/[eventId]/ReceiptDetail'
import { ReportAccess } from '@/components/citizen/ReportAccess'
import { WorkspaceSidebarView } from '@/components/citizen-workspace/Sidebar'
import { ReceiptsSplit } from '@/components/citizen-workspace/Split'
import type { AutoVerdicts, ReportInput } from '@/lib/data'
import { fakeHex, MOCK_BLOCK_BASE, mockSendReport, mockWorkspaceReceipts } from '@/lib/mock'
import type { ReceiptCheck } from '@/lib/receipt-state'
import type { ReceiptOpening, VerifyResult } from '@/lib/shared/types'
import { TICKET_STATES, type TicketState } from './states'

const NOW = Date.UTC(2026, 10, 21, 7, 3)
const CODE = 'K7M2QD'
const ALL = mockWorkspaceReceipts(NOW, CODE)
const SHARE = ALL.find((r) => r.eventId === 'evt_7Q2M4K') as ReceiptOpening
const TAMPERED: ReceiptOpening = { ...SHARE, eventType: 0 }
const EDITED: ReceiptOpening = { ...SHARE, eventType: 0, purposeText: 'Account review' }
const SEALING: ReceiptOpening = { ...ALL[0], status: 'submitted', txHash: null, logIndex: null }
// Real agency names are long (riset-ui brief): the hero must wrap or clamp cleanly next to the stamp.
const LONG: ReceiptOpening = { ...ALL[1], controllerName: 'Disdukcapil Kota Contoh (fiktif)', eventType: 2, purposeText: 'Verifikasi data kependudukan untuk layanan bansos' }
const RSUD: ReceiptOpening = { ...ALL[2], controllerName: 'RSUD Contoh (fiktif)' }
const WITH_TAMPER = ALL.map((r) => (r.eventId === SHARE.eventId ? TAMPERED : r))

const allMatch = (rs: ReceiptOpening[]): AutoVerdicts => Object.fromEntries(rs.map((r) => [r.eventId, 'match' as const]))
const MATCHED = allMatch(ALL)
const ALTERED_V: AutoVerdicts = { ...allMatch(WITH_TAMPER), [SHARE.eventId]: 'altered' }

const BASE = { blockNumber: MOCK_BLOCK_BASE - 214, confirmations: 214, rpc: 'ethereum-sepolia-rpc.publicnode.com' }
const MATCH: VerifyResult = { status: 'MATCH', mismatches: [], elapsedMs: 1840, ...BASE }
const EVENT_ALTERED: VerifyResult = { status: 'MISMATCH', mismatches: [{ field: 'eventType', db: 'READ', chain: 'SHARE_THIRD_PARTY' }], elapsedMs: 1320, ...BASE }
const TWO_ALTERED: VerifyResult = {
  status: 'MISMATCH',
  mismatches: [
    { field: 'eventType', db: 'READ', chain: 'SHARE_THIRD_PARTY' },
    { field: 'purpose', db: '"Account review" (fingerprint 0x4be1a0…c27d19)', chain: 'A different purpose (fingerprint 0x91c4f2…07ab3e)' },
  ],
  elapsedMs: 1910,
  ...BASE,
}
const NOT_FOUND: VerifyResult = { status: 'NOT_FOUND', mismatches: [], elapsedMs: 2410, rpc: BASE.rpc }
const done = (result: VerifyResult): ReceiptCheck => ({ phase: 'done', result, at: NOW })
const AI_TEXT =
  'Contoh Lending Co. recorded this access at the time shown, and nobody has changed the record since. Your phone compared it with the fingerprint sealed on the public chain and every field matched.'

const noop = () => {}
const send = (input: ReportInput) => mockSendReport(input.reason, 'ok')

function Detail({ opening, verify, check, ai = { state: 'idle' } }: { opening: ReceiptOpening; verify: DetailVerifyState; check?: ReceiptCheck; ai?: DetailAiState }) {
  return (
    <ReceiptDetailView
      opening={opening}
      now={NOW}
      verify={verify}
      check={check}
      ai={ai}
      onVerify={noop}
      onExplain={noop}
      onShowLimits={noop}
      onDownload={noop}
      onShare={noop}
      onKeepEvidence={noop}
      renderReport={(altered) => <ReportAccess eventId={opening.eventId} verdict={altered ? 'altered' : undefined} send={send} />}
    />
  )
}

function List({ receipts = ALL, verdicts = MATCHED, selectedId }: { receipts?: ReceiptOpening[]; verdicts?: AutoVerdicts; selectedId?: string }) {
  return <ReceiptListView state="ready" receipts={receipts} code={CODE} now={NOW} online watching freshIds={[]} verdicts={verdicts} selectedId={selectedId} onCopy={noop} onRetry={noop} />
}

function Profile({ receipts = ALL, verdicts = MATCHED }: { receipts?: ReceiptOpening[]; verdicts?: AutoVerdicts }) {
  return (
    <ProfileScreenView
      state="ready"
      profile={{ code: CODE, displayName: 'Synthetic citizen K7M' }}
      receipts={receipts}
      verdicts={verdicts}
      now={NOW}
      confirm="closed"
      modal={false}
      onCopy={noop}
      onAskDelete={noop}
      onCancelDelete={noop}
      onDeleteDemo={noop}
      onDownloadAll={noop}
      onRetry={noop}
    />
  )
}

function pane(state: TicketState): { body: ReactNode; selected?: string; receipts?: ReceiptOpening[]; verdicts?: AutoVerdicts } {
  switch (state) {
    case 'match':
      return { body: <Detail opening={SHARE} verify={{ phase: 'done', result: MATCH }} />, selected: SHARE.eventId }
    case 'match-ai':
      return { body: <Detail opening={SHARE} verify={{ phase: 'done', result: MATCH }} ai={{ state: 'done', data: { text: AI_TEXT, meta: { provider: 'example-provider', model: 'example-large', fallbackLevel: 'primary', latencyMs: 1380 } } }} />, selected: SHARE.eventId }
    case 'long':
      return { body: <Detail opening={LONG} verify={{ phase: 'idle' }} check={done(MATCH)} />, selected: LONG.eventId }
    case 'long-rsud':
      return { body: <Detail opening={RSUD} verify={{ phase: 'done', result: TWO_ALTERED }} />, selected: RSUD.eventId }
    case 'checking':
      return { body: <Detail opening={SHARE} verify={{ phase: 'running', elapsedMs: 1200 }} />, selected: SHARE.eventId }
    case 'idle':
      return { body: <Detail opening={ALL[2]} verify={{ phase: 'idle' }} />, selected: ALL[2].eventId }
    case 'pending':
      return { body: <Detail opening={SEALING} verify={{ phase: 'idle' }} />, selected: SEALING.eventId }
    case 'altered':
      return {
        body: <Detail opening={TAMPERED} verify={{ phase: 'done', result: EVENT_ALTERED }} check={done(EVENT_ALTERED)} />,
        selected: SHARE.eventId,
        receipts: WITH_TAMPER,
        verdicts: ALTERED_V,
      }
    case 'altered-fields':
      return { body: <Detail opening={EDITED} verify={{ phase: 'done', result: TWO_ALTERED }} />, selected: SHARE.eventId, receipts: WITH_TAMPER, verdicts: ALTERED_V }
    case 'notfound':
      return { body: <Detail opening={SHARE} verify={{ phase: 'done', result: NOT_FOUND }} />, selected: SHARE.eventId }
    case 'error':
      return { body: <Detail opening={SHARE} verify={{ phase: 'error', error: 'All three nodes timed out. Check your connection.' }} />, selected: SHARE.eventId }
    case 'missing':
      return { body: <ReceiptMissingView error={null} onRetry={noop} /> }
    case 'deleted':
      return {
        body: (
          <ReceiptMissingView
            error={null}
            onRetry={noop}
            report={<ReportAccess eventId="evt-ghost-0007" verdict="altered" chain={{ txHash: fakeHex('tx:ghost'), logIndex: 3 }} send={send} />}
          />
        ),
      }
    default:
      return { body: null }
  }
}

export function TicketGallery({ state }: { state: TicketState | null }) {
  if (!state) {
    return (
      <main id="main" className="min-h-dvh bg-paper px-6 py-10">
        <h1 className="text-[36px] font-medium tracking-[-0.04em] text-ink">
          Receipt ticket <span className="text-ink-2">every state.</span>
        </h1>
        <ul className="mt-6 flex max-w-[640px] flex-col border-t border-line">
          {(Object.keys(TICKET_STATES) as TicketState[]).map((k) => (
            <li key={k} className="border-b border-line">
              <Link href={`/dev/states/citizen/ticket?s=${k}`} className="flex min-h-11 items-center justify-between gap-4 py-2 text-[15px] text-ink hover:text-blue">
                {TICKET_STATES[k]}
                <span className="font-mono text-[12px] text-ink-2">?s={k}</span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    )
  }
  const profile = state.startsWith('profile')
  const sidebar = <WorkspaceSidebarView path={profile ? '/citizen/profile' : '/citizen'} code={CODE} watch="watching" count={ALL.length} onCopy={noop} />
  if (profile) {
    const body =
      state === 'profile-altered' ? (
        <Profile receipts={WITH_TAMPER} verdicts={ALTERED_V} />
      ) : state === 'profile-empty' ? (
        <Profile receipts={[]} verdicts={{}} />
      ) : (
        <Profile />
      )
    return <CitizenShell sidebar={sidebar}>{body}</CitizenShell>
  }
  const p = pane(state)
  return (
    <CitizenShell sidebar={sidebar}>
      <ReceiptsSplit focus="pane" list={<List receipts={p.receipts} verdicts={p.verdicts} selectedId={p.selected} />} pane={p.body} />
    </CitizenShell>
  )
}
