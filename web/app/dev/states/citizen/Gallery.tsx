'use client'

// Every state of every citizen screen, side by side at 390 px, forced through props.
// Frames use a CSS transform so the fixed TabBar / dialog overlay stay inside each frame.
import Link from 'next/link'
import { createContext, useContext, type ReactNode } from 'react'
import { CitizenShell } from '@/app/citizen/CitizenShell'
import { OnboardingView, ReceiptListView } from '@/app/citizen/CitizenHome'
import { ProfileScreenView, type ConfirmState, type ProfileState } from '@/app/citizen/profile/ProfileView'
import {
  ReceiptDetailView,
  ReceiptMissingView,
  type DetailAiState,
  type DetailVerifyState,
} from '@/app/citizen/receipt/[eventId]/ReceiptDetail'
import { AiPanel } from '@/components/ui/AiPanel'
import { ReceiptDetailSkeleton } from '@/components/ui/Skeleton'
import { ToastView } from '@/components/ui/Toast'
import type { AutoVerdicts, GhostReceipt } from '@/lib/data'
import { MOCK_BLOCK_BASE, mockAllReceipts, mockWorkspaceReceipts } from '@/lib/mock'
import type { ReceiptCheck } from '@/lib/receipt-state'
import type { AiMeta, ReceiptOpening, VerifyResult } from '@/lib/shared/types'

// ---- fixtures (fixed clock so every render is identical) ---------------------------------------

const NOW = Date.UTC(2026, 10, 21, 7, 3)
const CODE = 'K7M2QD'
const ALL = mockAllReceipts(NOW, CODE)
const NEW: ReceiptOpening = {
  ...ALL[0],
  createdAt: new Date(NOW - 4_000).toISOString(),
  status: 'pending',
  txHash: null,
  logIndex: null,
}
const RECEIPTS: ReceiptOpening[] = [
  NEW,
  ALL[1],
  { ...ALL[2], status: 'submitted' },
  { ...ALL[3], status: 'failed', txHash: null, logIndex: null },
  ALL[4],
]
const OPENING = ALL[1]
// What the tampered database now returns: the share was rewritten as a plain read for "Account review".
const EDITED: ReceiptOpening = { ...ALL[1], eventType: 0, purposeText: 'Account review' }
const SEALING: ReceiptOpening = { ...ALL[1], status: 'submitted', txHash: null, logIndex: null }

// red moment (riset-ui/24 §2): auto-verify verdicts per row + one remembered receipt the database lost
const CHECKING: AutoVerdicts = { [ALL[1].eventId]: 'match', [ALL[2].eventId]: 'verifying', [ALL[4].eventId]: 'verifying' }
const ALTERED_ROW: AutoVerdicts = { [ALL[1].eventId]: 'altered', [ALL[2].eventId]: 'match', [ALL[4].eventId]: 'match' }
const MIXED: AutoVerdicts = { [ALL[1].eventId]: 'match', [ALL[2].eventId]: 'not_found', [ALL[4].eventId]: 'match' }
const GHOST: GhostReceipt = {
  opening: { ...ALL[3], eventId: 'evt-ghost-0007', purposeText: 'Collections call list', status: 'anchored', createdAt: new Date(NOW - 26 * 3600_000).toISOString() },
  lastSeenAt: NOW - 2 * 3600_000,
}
const RPC = 'ethereum-sepolia-rpc.publicnode.com'
const BASE = { blockNumber: MOCK_BLOCK_BASE - 214, confirmations: 214, rpc: RPC }

const MATCH: VerifyResult = { status: 'MATCH', mismatches: [], elapsedMs: 1840, ...BASE }
const ALTERED: VerifyResult = {
  status: 'MISMATCH',
  mismatches: [
    { field: 'eventType', db: 'READ', chain: 'SHARE_THIRD_PARTY' },
    { field: 'purpose', db: '"Account review" (fingerprint 0x4be1a0…c27d19)', chain: 'A different purpose (fingerprint 0x91c4f2…07ab3e)' },
  ],
  elapsedMs: 1910,
  ...BASE,
}
const NOT_FOUND: VerifyResult = { status: 'NOT_FOUND', mismatches: [], elapsedMs: 2410, rpc: RPC }
const EVENT_ALTERED: VerifyResult = {
  status: 'MISMATCH',
  mismatches: [{ field: 'eventType', db: 'READ', chain: 'SHARE_THIRD_PARTY' }],
  elapsedMs: 1320,
  ...BASE,
}
const done = (result: VerifyResult): ReceiptCheck => ({ phase: 'done', result, at: NOW })
// The tamper demo: a SHARE_THIRD_PARTY receipt whose database row was edited to READ.
const TAMPERED: ReceiptOpening = { ...ALL[1], eventType: 0 }

const AI_ALTERED =
  'The company told Saksi it only read your data, but the chain sealed a record saying it was shared with a third party, for a different purpose. Someone edited the database after sealing. Saksi cannot say who or why. Keep the receipt file as evidence; you can show it to the regulator.'
const AI_TEXT =
  'Contoh Lending Co. recorded this access at the time shown, and nobody has changed the record since. Your phone compared it with the fingerprint sealed on the public chain and every field matched.'
const META: Record<AiMeta['fallbackLevel'], AiMeta> = {
  primary: { provider: 'example-provider', model: 'example-large', fallbackLevel: 'primary', latencyMs: 1380 },
  fallback: { provider: 'example-provider', model: 'example-mini', fallbackLevel: 'fallback', latencyMs: 2210 },
  cached: { provider: 'example-provider', model: 'example-large', fallbackLevel: 'cached', latencyMs: 12 },
  template: { provider: 'saksi', model: 'template-v1', fallbackLevel: 'template', latencyMs: 4 },
}

const noop = () => {}
const PROFILE = { code: CODE, displayName: 'Synthetic citizen K7M' }
// Profile: every company that opened this profile, counted from its receipts (CITIZEN WORKSPACE fixtures).
const WS = mockWorkspaceReceipts(NOW, CODE)
const WS_MATCH: AutoVerdicts = Object.fromEntries(WS.map((r) => [r.eventId, 'match' as const]))
const WS_ALTERED: AutoVerdicts = { ...WS_MATCH, evt_7Q2M4K: 'altered', [WS[0].eventId]: 'verifying' }

// ---- frames ------------------------------------------------------------------------------------

const Width = createContext(390)

function Frame({ label, children, bare }: { label: string; children: ReactNode; bare?: boolean }) {
  const w = useContext(Width)
  return (
    <figure className="shrink-0" style={{ width: w }}>
      <figcaption className="label mb-2 text-[11px] text-ink-2">{label}</figcaption>
      <div
        className={`relative flex flex-col overflow-hidden rounded-xl border border-line-strong bg-paper [transform:translateZ(0)] ${
          bare ? 'p-4' : 'min-h-[844px]'
        }`}
      >
        {bare ? children : <CitizenShell frame>{children}</CitizenShell>}
      </div>
    </figure>
  )
}

function Row({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return (
    <section className="mt-14">
      <h2 className="text-[22px] font-medium tracking-[-0.02em] text-ink">{title}</h2>
      <p className="mt-1 max-w-[80ch] text-[14px] text-ink-2">{note}</p>
      <div className="mt-5 flex flex-wrap items-start gap-6">{children}</div>
    </section>
  )
}

function Detail({
  verify,
  ai = { state: 'idle' },
  check,
  opening = OPENING,
}: {
  verify: DetailVerifyState
  ai?: DetailAiState
  check?: ReceiptCheck
  opening?: ReceiptOpening
}) {
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
    />
  )
}

function Profile({
  state,
  confirm = 'closed',
  error,
  receipts = WS,
  verdicts = WS_MATCH,
}: {
  state: ProfileState
  confirm?: ConfirmState
  error?: string
  receipts?: ReceiptOpening[]
  verdicts?: AutoVerdicts
}) {
  return (
    <ProfileScreenView
      state={state}
      profile={state === 'ready' ? PROFILE : null}
      receipts={receipts}
      verdicts={verdicts}
      now={NOW}
      onDownloadAll={noop}
      error={state === 'error' ? 'Could not reach the Saksi server. Check your connection.' : null}
      confirm={confirm}
      deleteError={error}
      modal={false}
      onCopy={noop}
      onAskDelete={noop}
      onCancelDelete={noop}
      onDeleteDemo={noop}
      onRetry={noop}
    />
  )
}

function List(props: Partial<Parameters<typeof ReceiptListView>[0]>) {
  return (
    <ReceiptListView
      state="ready"
      receipts={RECEIPTS}
      code={CODE}
      now={NOW}
      online
      watching
      freshIds={[NEW.eventId]}
      onCopy={noop}
      onRetry={noop}
      {...props}
    />
  )
}

// ---- gallery -----------------------------------------------------------------------------------

export function CitizenStatesGallery({ width = 390 }: { width?: number }) {
  return (
    <Width.Provider value={width}>
    <main id="main" className="min-h-dvh bg-paper-2/60 px-6 py-10">
      <h1 className="text-[36px] font-medium tracking-[-0.04em] text-ink">
        Citizen states <span className="text-ink-2">at {width} px.</span>
      </h1>
      <p className="mt-2 text-[14px] text-ink-2">
        Widths:{' '}
        <Link href="/dev/states/citizen" className="text-blue underline">
          390
        </Link>{' '}
        ·{' '}
        <Link href="/dev/states/citizen?w=360" className="text-blue underline">
          360
        </Link>
. Laptop workspace (sidebar, master–detail, profile):{' '}
        <Link href="/dev/states/citizen/workspace" className="text-blue underline">
          /dev/states/citizen/workspace
        </Link>
        . Reduced motion: emulate prefers-reduced-motion in devtools; every one-shot animation drops out.
      </p>
      <p className="mt-2 max-w-[80ch] text-[15px] text-ink-2">
        Forced through props on the presentational views (<code className="font-mono">OnboardingView</code>,{' '}
        <code className="font-mono">ReceiptListView</code>, <code className="font-mono">ReceiptDetailView</code>,{' '}
        <code className="font-mono">ProfileScreenView</code>). Handlers are no-ops here. Live flows:{' '}
        <Link href="/dev" className="text-blue underline">
          /dev
        </Link>
        .
      </p>

      <Row title="C1 · Onboarding" note="onCreateProfile → createProfile(). Error codes come from toCitizenError(err).code.">
        <Frame label="idle">
          <OnboardingView status="idle" onCreateProfile={noop} />
        </Frame>
        <Frame label="loading">
          <OnboardingView status="loading" onCreateProfile={noop} />
        </Frame>
        <Frame label="error · RATE_LIMITED (429)">
          <OnboardingView
            status="error"
            error={{ code: 'RATE_LIMITED', message: 'Too many profiles were created from this network. Try again in a minute.' }}
            onCreateProfile={noop}
          />
        </Frame>
        <Frame label="error · NETWORK">
          <OnboardingView
            status="error"
            error={{ code: 'NETWORK', message: 'Could not reach the Saksi server. Check your connection.' }}
            onCreateProfile={noop}
          />
        </Frame>
      </Row>

      <Row
        title="C2 · Receipts"
        note="getReceipts() polled every 3 s. Badges: pending/submitted → ON CHAIN, anchored → RECORDED, failed → FAILED. NEW card = freshIds. Each sealed receipt is then checked in this browser (useAutoVerify): MATCH, ALTERED (red card + banner), NOT FOUND."
      >
        <Frame label="ready · new arrival + all badges">
          <List />
        </Frame>
        <Frame label="loading">
          <List state="loading" receipts={[]} code="" freshIds={[]} />
        </Frame>
        <Frame label="empty">
          <List state="empty" receipts={[]} freshIds={[]} />
        </Frame>
        <Frame label="error + retry">
          <List
            state="error"
            receipts={[]}
            freshIds={[]}
            error="The Saksi server did not answer in time. Your receipts are safe on chain."
          />
        </Frame>
        <Frame label="offline (paused)">
          <List online={false} watching={false} freshIds={[]} />
        </Frame>
        <Frame label="toast · onCopy" bare>
          <div className="flex flex-col items-center gap-3 py-6">
            <ToastView text="Copied" />
            <ToastView text="Copy failed" tone="bad" />
          </div>
        </Frame>
      </Row>

      <Row
        title="C2r · The phone turns red"
        note="ReceiptListView verdicts={AutoVerdicts} + ghosts={GhostReceipt[]} (riset-ui/28). The teammate's auto-verify feeds verdicts; the remembered-receipts store feeds ghosts. Red only for ALTERED / DELETED."
      >
        <Frame label="auto-verify running (checking + checked)">
          <List verdicts={CHECKING} freshIds={[]} />
        </Frame>
        <Frame label="ALTERED · banner + red row">
          <List verdicts={ALTERED_ROW} freshIds={[]} />
        </Frame>
        <Frame label="DELETED · ghost card">
          <List verdicts={MIXED} ghosts={[GHOST]} freshIds={[]} />
        </Frame>
        <Frame label="ALTERED + DELETED">
          <List verdicts={ALTERED_ROW} ghosts={[GHOST]} freshIds={[]} />
        </Frame>
      </Row>

      <Row title="C3 · Receipt detail" note="findReceipt(eventId). Fingerprint: copy + explorer link from NEXT_PUBLIC_EXPLORER_URL.">
        <Frame label="loading">
          <ReceiptDetailSkeleton />
        </Frame>
        <Frame label="not found">
          <ReceiptMissingView error={null} onRetry={noop} />
        </Frame>
        <Frame label="load error + retry">
          <ReceiptMissingView error="Could not reach the Saksi server. Check your connection." onRetry={noop} />
        </Frame>
        <Frame label="ready · before verify">
          <Detail verify={{ phase: 'idle' }} />
        </Frame>
        <Frame label="pending · waiting for the chain (amber)">
          <Detail verify={{ phase: 'idle' }} opening={SEALING} />
        </Frame>
      </Row>

      <Row title="C4 · Verify" note="onVerify → verifyTimed(); the timer is the round trip measured in the browser.">
        <Frame label="verifying · 1.2 s">
          <Detail verify={{ phase: 'running', elapsedMs: 1200 }} />
        </Frame>
        <Frame label="MATCH">
          <Detail verify={{ phase: 'done', result: MATCH }} />
        </Frame>
        <Frame label="ALTERED · comparison + actions">
          <Detail verify={{ phase: 'done', result: ALTERED }} opening={EDITED} />
        </Frame>
        <Frame label="ALTERED · Ask AI answered">
          <Detail verify={{ phase: 'done', result: ALTERED }} opening={EDITED} ai={{ state: 'done', data: { text: AI_ALTERED, meta: META.primary } }} />
        </Frame>
        <Frame label="ALTERED · event type (tamper demo)">
          <Detail opening={TAMPERED} verify={{ phase: 'done', result: EVENT_ALTERED }} />
        </Frame>
        <Frame label="ALTERED · caught in background, before a tap">
          <Detail opening={TAMPERED} verify={{ phase: 'idle' }} check={done(EVENT_ALTERED)} />
        </Frame>
        <Frame label="NOT FOUND ON THIS NODE (gray)">
          <Detail verify={{ phase: 'done', result: NOT_FOUND }} />
        </Frame>
        <Frame label="verify error">
          <Detail verify={{ phase: 'error', error: 'All three nodes timed out. Check your connection.' }} />
        </Frame>
      </Row>

      <Row title="C4d · AI panel" note="onExplain → explain(). Chip model + fallback label come from the response meta.">
        <Frame label="screen · AI loading">
          <Detail verify={{ phase: 'done', result: MATCH }} ai={{ state: 'loading' }} />
        </Frame>
        <Frame label="primary" bare>
          <AiPanel state="done" text={AI_TEXT} meta={META.primary} />
        </Frame>
        <Frame label="fallback" bare>
          <AiPanel state="done" text={AI_TEXT} meta={META.fallback} />
        </Frame>
        <Frame label="cached" bare>
          <AiPanel state="done" text={AI_TEXT} meta={META.cached} />
        </Frame>
        <Frame label="template" bare>
          <AiPanel state="done" text={AI_TEXT} meta={META.template} />
        </Frame>
        <Frame label="error + retry" bare>
          <AiPanel state="error" error="The AI service is busy. The verdict above does not depend on it." onRetry={noop} />
        </Frame>
      </Row>

      <Row title="C5 · Profile" note="getProfile(), onCopy → copyText(), onDeleteDemo → deleteProfile().">
        <Frame label="loading">
          <Profile state="loading" />
        </Frame>
        <Frame label="no profile">
          <Profile state="none" />
        </Frame>
        <Frame label="load error">
          <Profile state="error" />
        </Frame>
        <Frame label="ready · who opened your data + rights">
          <Profile state="ready" />
        </Frame>
        <Frame label="ready · one record altered">
          <Profile state="ready" verdicts={WS_ALTERED} />
        </Frame>
        <Frame label="ready · no receipts yet">
          <Profile state="ready" receipts={[]} verdicts={{}} />
        </Frame>
        <Frame label="confirm delete">
          <Profile state="ready" confirm="open" />
        </Frame>
        <Frame label="deleting">
          <Profile state="ready" confirm="deleting" />
        </Frame>
        <Frame label="delete error">
          <Profile state="ready" confirm="error" error="Could not reach the Saksi server. Check your connection." />
        </Frame>
      </Row>
    </main>
    </Width.Provider>
  )
}
