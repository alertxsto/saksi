'use client'

import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { Countdown72 } from '@/components/ui/Countdown72'
import { TwoTone } from '@/components/ui/Chip'
import { TxFlow, type TxView } from '@/components/ui/TxStepper'
import { WalletGate, WalletStrip, WALLET_STATES, type WalletView } from '@/components/ui/WalletGate'
import { RecentReceipts } from '@/app/controller/RecentReceipts'
import { RecordAccessForm } from '@/app/controller/RecordAccessForm'
import { BreachView, type CheckState, type DraftState, type Edited } from '@/app/controller/breach/BreachView'
import type { BreachDraft, TxErrorInfo } from '@/lib/data'
import { useNow } from '@/lib/hooks'
import { fakeHex, mockBlockNumber, mockDraftBreach, mockRecentAccess, mockWalletSnapshot } from '@/lib/mock'

const noop = () => {}
const H = 3600
const NARRATIVE =
  'Yesterday our engineer found a customer export file in a storage bucket that was public. It had names, phone numbers and loan balances. We closed it and rotated keys.'
const TX = fakeHex('gallery:tx')
const ERR: Record<'rejected' | 'revert' | 'timeout', TxErrorInfo> = {
  rejected: { code: 'USER_REJECTED', message: 'You rejected the request in your wallet. Nothing was sent.' },
  revert: { code: 'TX_REVERTED', message: 'The contract refused this transaction.', errorName: 'ControllerNotActive' },
  timeout: { code: 'NOT_MINED', message: 'The transaction is not on chain yet. Try Re-confirm in a moment.' },
}

function Frame({ title, note, children, className = '' }: { title: string; note?: string; children: ReactNode; className?: string }) {
  return (
    <figure className={`flex min-w-0 flex-col gap-3 ${className}`}>
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2 border-b border-dashed border-line-strong pb-2">
        <span className="label text-ink">{title}</span>
        {note ? <code className="font-mono text-[12px] text-blue">{note}</code> : null}
      </figcaption>
      {children}
    </figure>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-6">
      <h2 className="text-[24px] font-medium tracking-[-0.02em] text-ink">{title}</h2>
      {children}
    </section>
  )
}

type BreachCase = {
  title: string
  note: string
  draft: DraftState
  fields: 'none' | 'draft' | 'edited'
  hoursAgo: number
  check: CheckState['status']
  mode?: 'on_time' | 'late'
  tx?: TxView
}

export function ControllerGallery() {
  const now = useNow()
  const nowSec = now ? Math.floor(now / 1000) : 0
  const block = now ? mockBlockNumber() : null
  const draftQ = useQuery<BreachDraft>({ queryKey: ['dev', 'controller', 'draft'], queryFn: async () => ({ ...(await mockDraftBreach(NARRATIVE)), aiRunId: null }) })
  const ai = draftQ.data
  const recentRows = now ? [...mockRecentAccess(now), ...mockRecentAccess(now - 3 * H * 1000).map((r) => ({ ...r, id: `${r.id}b` }))] : []

  const wallet = (s: (typeof WALLET_STATES)[number], patch: Partial<WalletView> = {}): WalletView => ({ ...mockWalletSnapshot(s), ...patch })

  const steps: { title: string; tx: TxView; note?: string }[] = [
    { title: 'Idle', tx: { phase: 'idle' } },
    { title: 'Preparing', tx: { phase: 'preparing' } },
    { title: 'Signing', tx: { phase: 'signing' } },
    { title: 'Broadcast', tx: { phase: 'broadcast', txHash: TX } },
    { title: 'Confirmed', tx: { phase: 'confirmed', txHash: TX, blockNumber: block } },
    { title: 'Error · rejected in MetaMask', note: 'onRetry', tx: { phase: 'error', failedStep: 'signing', error: ERR.rejected } },
    { title: 'Error · revert', note: 'onRetry', tx: { phase: 'error', failedStep: 'broadcast', error: ERR.revert, txHash: TX } },
    { title: 'Error · timeout', note: 'onReconfirm', tx: { phase: 'error', failedStep: 'broadcast', error: ERR.timeout, txHash: TX } },
    {
      title: 'Timeout · re-confirming',
      note: 'onReconfirm',
      tx: { phase: 'error', failedStep: 'broadcast', error: ERR.timeout, txHash: TX, reconfirming: true },
    },
  ]

  const editedFields = ai ? { ...ai.fields, contact: 'Privacy desk — privacy@contoh-lending.example (fictional)' } : null
  const breachCases: BreachCase[] = [
    { title: 'Empty · nothing drafted', note: 'onDraft', draft: { status: 'idle' }, fields: 'none', hoursAgo: 2, check: 'idle' },
    { title: 'Draft loading', note: 'onDraft', draft: { status: 'loading' }, fields: 'none', hoursAgo: 2, check: 'idle' },
    { title: 'Draft error', note: 'onDraft', draft: { status: 'error', error: 'The AI service did not answer in time.' }, fields: 'none', hoursAgo: 2, check: 'idle' },
    { title: 'Drafted · AI chips on all 4', note: 'onCheckWithContract', draft: { status: 'done', meta: ai?.meta }, fields: 'draft', hoursAgo: 30.8, check: 'idle' },
    { title: 'Edited · (d) chip cleared', note: 'onCheckWithContract', draft: { status: 'done', meta: ai?.meta }, fields: 'edited', hoursAgo: 30.8, check: 'idle' },
    { title: 'Checking with contract', note: 'onCheckWithContract', draft: { status: 'done', meta: ai?.meta }, fields: 'edited', hoursAgo: 30.8, check: 'checking' },
    { title: 'Check · on time', note: 'onAnchor', draft: { status: 'done', meta: ai?.meta }, fields: 'edited', hoursAgo: 30.8, check: 'on_time' },
    { title: 'Check · late', note: 'onRecordLate', draft: { status: 'done', meta: ai?.meta }, fields: 'edited', hoursAgo: 100, check: 'late' },
    {
      title: 'Sealing on time · broadcast',
      note: 'onReconfirm / onRetry',
      draft: { status: 'done', meta: ai?.meta },
      fields: 'edited',
      hoursAgo: 30.8,
      check: 'on_time',
      mode: 'on_time',
      tx: { phase: 'broadcast', txHash: TX },
    },
    {
      title: 'Sealed · on time',
      note: 'onReset',
      draft: { status: 'done', meta: ai?.meta },
      fields: 'edited',
      hoursAgo: 30.8,
      check: 'on_time',
      mode: 'on_time',
      tx: { phase: 'confirmed', txHash: TX, blockNumber: block },
    },
    {
      title: 'Sealed · LATE',
      note: 'onReset',
      draft: { status: 'done', meta: ai?.meta },
      fields: 'edited',
      hoursAgo: 100,
      check: 'late',
      mode: 'late',
      tx: { phase: 'confirmed', txHash: TX, blockNumber: block },
    },
  ]

  return (
    <div className="flex flex-col gap-16">
      <div>
        <TwoTone head="Controller." tail="Every state, side by side." className="text-[40px]" />
        <p className="mt-3 max-w-[70ch] text-[15px] leading-relaxed text-ink-2">
          Static renders of the components the controller pages use, fed with lib/mock.ts data. Blue labels name the handler a
          button calls. Live pages: <code className="font-mono text-ink">/controller</code> and{' '}
          <code className="font-mono text-ink">/controller/breach</code>.
        </p>
      </div>

      <Section title="Wallet gate · 6 states (+ checking)">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {WALLET_STATES.map((s) => (
            <Frame
              key={s}
              title={s.replace('_', ' ')}
              note={
                { no_wallet: 'METAMASK_URL', disconnected: 'onConnect', wrong_network: 'onSwitchNetwork', not_registered: 'onCopy · onRefresh', no_gas: 'FAUCET_URL · onRefresh', ready: '—' }[s]
              }
            >
              <WalletStrip state={s} />
              <WalletGate wallet={wallet(s)} onConnect={noop} onSwitchNetwork={noop} onRefresh={noop} onCopy={noop}>
                <p className="rounded-lg border border-dashed border-line-strong p-4 text-[14px] text-ink-2">The record-access form renders here.</p>
              </WalletGate>
            </Frame>
          ))}
          <Frame title="checking (isChecking)">
            <WalletGate wallet={wallet('disconnected', { isChecking: true })} />
          </Frame>
          <Frame title="disconnected · connecting + error" note="onConnect">
            <WalletGate wallet={wallet('disconnected', { isConnecting: true, error: 'You rejected the request in your wallet.' })} onConnect={noop} />
          </Frame>
        </div>
      </Section>

      <Section title="Record-access form">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <Frame title="Empty" note="onSeal">
            <RecordAccessForm controllerName={mockWalletSnapshot().controller?.name ?? ''} onSeal={noop} />
          </Frame>
          <Frame title="Validation errors" note="onSeal (blocked)">
            <RecordAccessForm
              controllerName={mockWalletSnapshot().controller?.name ?? ''}
              initial={{ subjectCode: 'K7O1', purposeText: '' }}
              showErrors
              onSeal={noop}
            />
          </Frame>
          <Frame title="Filled · sealing" note="onSeal">
            <RecordAccessForm
              controllerName={mockWalletSnapshot().controller?.name ?? ''}
              initial={{ subjectCode: 'K7M2QD', eventType: 3, purposeText: 'Debt collection', legalBasisKey: 'PDP-20-2-f' }}
              busy
              onSeal={noop}
            />
          </Frame>
        </div>
      </Section>

      <Section title="Transaction stepper">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {steps.map((s) => (
            <Frame key={s.title} title={s.title} note={s.note}>
              <div className="rounded-lg border border-line bg-card p-5">
                <TxFlow tx={s.tx} onRetry={noop} onReconfirm={noop} />
              </div>
            </Frame>
          ))}
        </div>
      </Section>

      <Section title="Recent receipts (last 10)">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          <Frame title="Ready · 8 rows">
            <RecentReceipts status="ready" rows={recentRows} />
          </Frame>
          <Frame title="Loading">
            <RecentReceipts status="loading" rows={[]} />
          </Frame>
          <Frame title="Empty">
            <RecentReceipts status="ready" rows={[]} />
          </Frame>
          <Frame title="Error" note="onRetry">
            <RecentReceipts status="error" rows={[]} error="Could not load recent records. Check your connection and try again." onRetry={noop} />
          </Frame>
          <Frame title="Locked (wallet not ready)">
            <RecentReceipts status="locked" rows={[]} />
          </Frame>
        </div>
      </Section>

      <Section title="72-hour countdown">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {[
            ['On time · 30.8 H used', 30.8],
            ['Warning · under 12 H left', 64],
            ['Late · past 72 H', 100],
          ].map(([t, h]) => (
            <Frame key={t as string} title={t as string}>
              <div className="rounded-lg border border-line bg-card p-5">
                {nowSec ? <Countdown72 detectedAtSec={nowSec - (h as number) * H} /> : null}
              </div>
            </Frame>
          ))}
        </div>
      </Section>

      <Section title="Breach notice">
        <div className="flex flex-col gap-14">
          {breachCases.map((c) => {
            const fields = c.fields === 'none' ? null : c.fields === 'edited' ? editedFields : (ai?.fields ?? null)
            const edited: Edited = c.fields === 'edited' ? { contact: true } : {}
            return (
              <Frame key={c.title} title={c.title} note={c.note}>
                <BreachView
                  narrative={c.fields === 'none' && c.draft.status === 'idle' ? '' : NARRATIVE}
                  onNarrativeChange={noop}
                  draft={c.draft}
                  onDraft={noop}
                  fields={fields}
                  edited={edited}
                  onFieldChange={noop}
                  detectedAtSec={nowSec ? nowSec - c.hoursAgo * H : 0}
                  onDetectedAtChange={noop}
                  affected={c.fields === 'none' ? '' : '1240'}
                  onAffectedChange={noop}
                  check={{ status: c.check, deadlineSec: nowSec ? nowSec - c.hoursAgo * H + 72 * H : undefined }}
                  onCheckWithContract={noop}
                  mode={c.mode ?? null}
                  tx={c.tx ?? { phase: 'idle' }}
                  onAnchor={noop}
                  onRecordLate={noop}
                  onRetry={noop}
                  onReconfirm={noop}
                  onReset={noop}
                />
              </Frame>
            )
          })}
          <Frame title="Seal panel · wallet not ready" note="onSwitchNetwork">
            <div className="max-w-[480px] rounded-lg border border-line bg-card p-5">
              <WalletGate wallet={wallet('wrong_network')} onSwitchNetwork={noop} />
            </div>
          </Frame>
        </div>
      </Section>
    </div>
  )
}
