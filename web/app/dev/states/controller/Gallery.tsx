'use client'

import { useState, type ReactNode } from 'react'
import { ConsoleHead, MetaLine } from '@/components/controller/ConsoleHead'
import { ChamberHeadline, TxChamber, WorkPanel } from '@/components/controller/TxChamber'
import { Button } from '@/components/ui/Button'
import { Countdown72 } from '@/components/ui/Countdown72'
import { TwoTone } from '@/components/ui/Chip'
import type { TxView } from '@/components/ui/TxStepper'
import { WalletGate, WALLET_STATES, type WalletView } from '@/components/ui/WalletGate'
import { RecentReceipts } from '@/app/controller/RecentReceipts'
import { RecordAccessForm } from '@/app/controller/RecordAccessForm'
import { BreachView, type CheckState, type DraftState, type Edited } from '@/app/controller/breach/BreachView'
import type { RecentAccess, TxErrorInfo } from '@/lib/data'
import { useNow } from '@/lib/hooks'
import { CONTROLLER_DRAFT_FIXTURE, fakeHex, mockBlockNumber, mockRecentAccess, mockWalletSnapshot } from '@/lib/mock'

const noop = () => {}
const H = 3600
/** Fixed base time for the first paint (20 Nov 2026, 10:00 WIB); replaced by the live clock after mount. */
const GALLERY_EPOCH_SEC = 1_795_143_600
const NARRATIVE =
  'Yesterday our engineer found a customer export file in a storage bucket that was public. It had names, phone numbers and loan balances. We closed it and rotated keys.'
const TX = fakeHex('gallery:tx')
const ERR: Record<'rejected' | 'revert' | 'timeout', TxErrorInfo> = {
  rejected: { code: 'USER_REJECTED', message: 'You rejected the request in your wallet. Nothing was sent.' },
  revert: { code: 'TX_REVERTED', message: 'The contract refused this transaction.', errorName: 'ControllerNotActive' },
  timeout: { code: 'NOT_MINED', message: 'Sepolia has not mined this transaction yet. Saksi keeps checking on its own.' },
}
const NEW_CODES = ['P3WK7N', 'T8HQ2C', 'M5RX9B', 'D4GV6J', 'Z7NC3E']

function Frame({ title, note, children, className = '' }: { title: string; note?: string; children: ReactNode; className?: string }) {
  return (
    <figure className={`flex min-w-0 flex-col gap-4 ${className}`}>
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
    <section className="flex flex-col gap-8">
      <h2 className="text-[28px] font-medium tracking-[-0.02em] text-ink">{title}</h2>
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
  checkError?: string
  mode?: 'on_time' | 'late'
  tx?: TxView
  gated?: boolean
}

/** Recent list with a button that seals a fake new row, to watch the arrival motion. */
function LiveRecent({ now }: { now: number }) {
  const [rows, setRows] = useState<RecentAccess[] | null>(null)
  const base = rows ?? (now ? mockRecentAccess(now) : [])
  const add = () => {
    const n = (rows ?? base).length
    const code = NEW_CODES[n % NEW_CODES.length]
    const row: RecentAccess = {
      id: `live_${n}_${code}`,
      citizenCode: code,
      eventType: (n % 4) as RecentAccess['eventType'],
      status: 'anchored',
      txHash: fakeHex(`live:${n}:${code}`),
      createdAt: new Date().toISOString(),
    }
    setRows([row, ...(rows ?? base)].slice(0, 10))
  }
  return (
    <div className="flex flex-col gap-4">
      <Button variant="light" size="sm" onClick={add} className="self-start">
        Seal a new row (demo)
      </Button>
      <RecentReceipts status="ready" rows={base} />
    </div>
  )
}

export function ControllerGallery() {
  const now = useNow()
  // Fixtures never wait on the clock: before the first tick the gallery uses a fixed base time, so every
  // breach frame has a detection time, a deadline and a running clock on first paint.
  const nowSec = now ? Math.floor(now / 1000) : GALLERY_EPOCH_SEC
  const block = now ? mockBlockNumber() : null
  const ai = CONTROLLER_DRAFT_FIXTURE
  const recentRows = now ? [...mockRecentAccess(now), ...mockRecentAccess(now - 3 * H * 1000).map((r) => ({ ...r, id: `${r.id}b` }))] : []
  const controllerName = mockWalletSnapshot().controller?.name ?? ''

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

  const editedFields = { ...ai.fields, contact: 'Privacy desk — privacy@contoh-lending.example (fictional)' }
  const done: DraftState = { status: 'done', meta: ai.meta }
  const breachCases: BreachCase[] = [
    { title: 'Empty · nothing drafted', note: 'onDraft', draft: { status: 'idle' }, fields: 'none', hoursAgo: 2, check: 'idle' },
    { title: 'Draft loading', note: 'onDraft', draft: { status: 'loading' }, fields: 'none', hoursAgo: 2, check: 'idle' },
    { title: 'Draft error', note: 'onDraft', draft: { status: 'error', error: 'The AI service did not answer in time.' }, fields: 'none', hoursAgo: 2, check: 'idle' },
    { title: 'Drafted · AI chips on all 4', note: 'onCheckWithContract', draft: done, fields: 'draft', hoursAgo: 30.8, check: 'idle' },
    { title: 'Edited · (d) chip cleared', note: 'onCheckWithContract', draft: done, fields: 'edited', hoursAgo: 30.8, check: 'idle' },
    { title: 'Checking with contract', note: 'onCheckWithContract', draft: done, fields: 'edited', hoursAgo: 30.8, check: 'checking' },
    {
      title: 'Check error',
      note: 'onCheckWithContract',
      draft: done,
      fields: 'edited',
      hoursAgo: 30.8,
      check: 'error',
      checkError: 'Could not reach the contract. Check your connection and try again.',
    },
    { title: 'Check · on time', note: 'onAnchor', draft: done, fields: 'edited', hoursAgo: 30.8, check: 'on_time' },
    { title: 'Check · under 12 H left', note: 'onAnchor', draft: done, fields: 'edited', hoursAgo: 64, check: 'on_time' },
    { title: 'Check · late', note: 'onRecordLate', draft: done, fields: 'edited', hoursAgo: 100, check: 'late' },
    {
      title: 'Sealing on time · broadcast',
      note: 'onReconfirm / onRetry',
      draft: done,
      fields: 'edited',
      hoursAgo: 30.8,
      check: 'on_time',
      mode: 'on_time',
      tx: { phase: 'broadcast', txHash: TX },
    },
    { title: 'Sealed · on time', note: 'onReset', draft: done, fields: 'edited', hoursAgo: 30.8, check: 'on_time', mode: 'on_time', tx: { phase: 'confirmed', txHash: TX, blockNumber: block } },
    { title: 'Sealed · LATE', note: 'onReset', draft: done, fields: 'edited', hoursAgo: 100, check: 'late', mode: 'late', tx: { phase: 'confirmed', txHash: TX, blockNumber: block } },
    { title: 'Seal panel · wallet not ready', note: 'onSwitchNetwork', draft: done, fields: 'edited', hoursAgo: 30.8, check: 'idle', gated: true },
  ]

  return (
    <div className="flex flex-col gap-20">
      <div>
        <TwoTone head="Controller." tail="Every state, side by side." className="text-[40px]" />
        <p className="mt-3 max-w-[70ch] text-[15px] leading-relaxed text-ink-2">
          Static renders of the components the controller pages use, fed with lib/mock.ts data. Blue labels name the handler a
          button calls. Live pages: <code className="font-mono text-ink">/controller</code> and{' '}
          <code className="font-mono text-ink">/controller/breach</code>.
        </p>
      </div>

      <Section title="Wallet gate · 6 states (+ checking)">
        <div className="flex flex-col gap-12">
          {WALLET_STATES.filter((s) => s !== 'ready').map((s) => (
            <Frame
              key={s}
              title={`gate · ${s.replace('_', ' ')}`}
              note={{ no_wallet: 'METAMASK_URL', disconnected: 'onConnect', wrong_network: 'onSwitchNetwork', not_registered: 'onCopy · onRefresh', no_gas: 'FAUCET_URL · onRefresh', ready: '—' }[s]}
            >
              <WalletGate wallet={wallet(s)} onConnect={noop} onSwitchNetwork={noop} onRefresh={noop} onCopy={noop} />
            </Frame>
          ))}
          <Frame title="gate · ready (identity line + children)">
            <WalletGate wallet={wallet('ready')}>
              <p className="rounded-lg border border-dashed border-line-strong p-4 text-[14px] text-ink-2">The record-access form renders here.</p>
            </WalletGate>
          </Frame>
          <Frame title="gate · checking (isChecking)">
            <WalletGate wallet={wallet('wrong_network', { isChecking: true })} />
          </Frame>
          <Frame title="gate · disconnected · connecting + error" note="onConnect">
            <WalletGate wallet={wallet('disconnected', { isConnecting: true, error: 'You rejected the request in your wallet.' })} onConnect={noop} />
          </Frame>
          <div className="grid gap-8 lg:grid-cols-3">
            {(['disconnected', 'not_registered', 'no_gas'] as const).map((s) => (
              <Frame key={s} title={`inline · ${s.replace('_', ' ')}`} note="variant=inline">
                <WorkPanel label="Seal the notice" head={<ChamberHeadline title="Ask the contract first" tone="idle" />}>
                  <WalletGate variant="inline" wallet={wallet(s)} onConnect={noop} onRefresh={noop} onCopy={noop} />
                </WorkPanel>
              </Frame>
            ))}
          </div>
        </div>
      </Section>

      <Section title="Record access · form + citizen phone + transaction">
        <div className="flex flex-col gap-16">
          <Frame title="Console · ready (composed like /controller)" note="onSeal · onRetry · onReconfirm">
            <div className="flex flex-col gap-12">
              <ConsoleHead
                lead="Record an access."
                tail="The citizen sees it in seconds."
                aside={<MetaLine items={['Pseudonym + fingerprint only', 'Signed by your wallet']} />}
              >
                Each time your team opens a citizen’s data, write down what you did and why. Saksi seals its fingerprint on chain
                and the citizen’s phone gets the receipt.
              </ConsoleHead>
              <WalletGate wallet={wallet('ready')}>
                <RecordAccessForm
                  controllerName={controllerName}
                  initial={{ subjectCode: 'K7M2QD', eventType: 3, purposeText: 'Debt collection', legalBasisKey: 'PDP-20-2-f', dataCategories: ['address', 'contact'], operatorRef: 'desk-07' }}
                  onSeal={noop}
                  aside={<TxChamber tx={{ phase: 'idle' }} />}
                />
              </WalletGate>
              <RecentReceipts status="ready" rows={recentRows} />
            </div>
          </Frame>
          <Frame title="Empty" note="onSeal">
            <RecordAccessForm controllerName={controllerName} onSeal={noop} aside={<TxChamber tx={{ phase: 'idle' }} />} />
          </Frame>
          <Frame title="Validation errors" note="onSeal (blocked)">
            <RecordAccessForm controllerName={controllerName} initial={{ subjectCode: 'K7O1', purposeText: '' }} showErrors onSeal={noop} />
          </Frame>
          <Frame title="Filled · signing" note="onSeal">
            <RecordAccessForm
              controllerName={controllerName}
              initial={{ subjectCode: 'K7M2QD', eventType: 3, purposeText: 'Debt collection', legalBasisKey: 'PDP-20-2-f', dataCategories: ['address', 'contact'], operatorRef: 'desk-07' }}
              busy
              onSeal={noop}
              aside={<TxChamber tx={{ phase: 'signing' }} />}
            />
          </Frame>
          <Frame title="Sealed · preview shows RECORDED" note="previewStatus=anchored">
            <RecordAccessForm
              controllerName={controllerName}
              initial={{ subjectCode: 'K7M2QD', eventType: 2, purposeText: 'Monthly regulator audit export', legalBasisKey: 'PDP-20-2-c' }}
              previewStatus="anchored"
              onSeal={noop}
              aside={<TxChamber tx={{ phase: 'confirmed', txHash: TX, blockNumber: block }} />}
            />
          </Frame>
        </div>
      </Section>

      <Section title="Transaction chamber">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
          {steps.map((s) => (
            <Frame key={s.title} title={`tx · ${s.title}`} note={s.note}>
              <TxChamber tx={s.tx} onRetry={noop} onReconfirm={noop} />
            </Frame>
          ))}
        </div>
      </Section>

      <Section title="Recent receipts (last 10)">
        <div className="flex flex-col gap-14">
          <Frame title="Ready · 8 rows">
            <RecentReceipts status="ready" rows={recentRows} />
          </Frame>
          <Frame title="Live · new row arrives" note="slide + tint + hash scramble">
            <LiveRecent now={now} />
          </Frame>
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
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
        </div>
      </Section>

      <Section title="72-hour countdown">
        <div className="flex flex-col gap-12">
          {[
            ['On time · 30.8 H used', 30.8],
            ['Warning · under 12 H left', 64],
            ['Late · past 72 H', 100],
          ].map(([t, h]) => (
            <Frame key={t as string} title={`clock · ${t as string}`}>
              <Countdown72 detectedAtSec={nowSec - (h as number) * H} />
            </Frame>
          ))}
        </div>
      </Section>

      <Section title="Breach notice">
        <div className="flex flex-col gap-20">
          {breachCases.map((c) => {
            const fields = c.fields === 'none' ? null : c.fields === 'edited' ? editedFields : ai.fields
            const edited: Edited = c.fields === 'edited' ? { contact: true } : {}
            return (
              <Frame key={c.title} title={`breach · ${c.title}`} note={c.note}>
                <BreachView
                  narrative={c.fields === 'none' && c.draft.status === 'idle' ? '' : NARRATIVE}
                  onNarrativeChange={noop}
                  draft={c.draft}
                  onDraft={noop}
                  fields={fields}
                  edited={edited}
                  onFieldChange={noop}
                  detectedAtSec={nowSec - c.hoursAgo * H}
                  onDetectedAtChange={noop}
                  affected={c.fields === 'none' ? '' : '1240'}
                  onAffectedChange={noop}
                  check={{ status: c.check, error: c.checkError, deadlineSec: nowSec - c.hoursAgo * H + 72 * H }}
                  onCheckWithContract={noop}
                  mode={c.mode ?? null}
                  tx={c.tx ?? { phase: 'idle' }}
                  onAnchor={noop}
                  onRecordLate={noop}
                  onRetry={noop}
                  onReconfirm={noop}
                  onReset={noop}
                  gate={c.gated ? () => <WalletGate variant="inline" wallet={wallet('wrong_network')} onSwitchNetwork={noop} /> : undefined}
                />
              </Frame>
            )
          })}
        </div>
      </Section>
    </div>
  )
}
