'use client'

// Laptop workspace states, one per URL (?s=…), rendered full-screen in the real CitizenShell so a
// screenshot at 1440 / 1280 / 1024 shows exactly what a laptop sees (390 shows the phone layout).
import Link from 'next/link'
import { useEffect, useState, type ReactNode } from 'react'
import { CitizenShell } from '@/app/citizen/CitizenShell'
import { OnboardingView, ReceiptListView } from '@/app/citizen/CitizenHome'
import { ProfileScreenView, type ConfirmState } from '@/app/citizen/profile/ProfileView'
import { ReceiptDetailView, type DetailVerifyState } from '@/app/citizen/receipt/[eventId]/ReceiptDetail'
import type { PassVerdict } from '@/components/citizen/CitizenPass'
import { WorkspaceSidebarView, type SidebarWatch } from '@/components/citizen-workspace/Sidebar'
import { ReceiptsSplit, SelectReceiptPane } from '@/components/citizen-workspace/Split'
import type { AutoVerdicts, GhostReceipt } from '@/lib/data'
import { MOCK_BLOCK_BASE, mockWorkspaceReceipts } from '@/lib/mock'
import type { ReceiptCheck } from '@/lib/receipt-state'
import type { ReceiptOpening, VerifyResult } from '@/lib/shared/types'
import { WORKSPACE_STATES, type WorkspaceState } from './states'

const NOW = Date.UTC(2026, 10, 21, 7, 3)
const CODE = 'K7M2QD'
const ALL = mockWorkspaceReceipts(NOW, CODE)
const SHARE = ALL.find((r) => r.eventId === 'evt_7Q2M4K') as ReceiptOpening
// The tamper demo: the sealed SHARE_THIRD_PARTY row edited to a plain READ in the database.
const TAMPERED: ReceiptOpening = { ...SHARE, eventType: 0 }
const WITH_TAMPER = ALL.map((r) => (r.eventId === SHARE.eventId ? TAMPERED : r))

const allMatch = (rs: ReceiptOpening[]): AutoVerdicts => Object.fromEntries(rs.map((r) => [r.eventId, 'match' as const]))
const MATCHED = allMatch(ALL)
const ALTERED_V: AutoVerdicts = { ...allMatch(WITH_TAMPER), [SHARE.eventId]: 'altered' }
const CHECKING_V: AutoVerdicts = { ...MATCHED, [ALL[0].eventId]: 'verifying', [ALL[2].eventId]: 'verifying' }

const GHOST: GhostReceipt = {
  opening: { ...ALL[3], eventId: 'evt-ghost-0007', purposeText: 'Collections call list', status: 'anchored', createdAt: new Date(NOW - 26 * 3600_000).toISOString() },
  lastSeenAt: NOW - 2 * 3600_000,
}

const BASE = { blockNumber: MOCK_BLOCK_BASE - 214, confirmations: 214, rpc: 'ethereum-sepolia-rpc.publicnode.com' }
const MATCH: VerifyResult = { status: 'MATCH', mismatches: [], elapsedMs: 1840, ...BASE }
const EVENT_ALTERED: VerifyResult = { status: 'MISMATCH', mismatches: [{ field: 'eventType', db: 'READ', chain: 'SHARE_THIRD_PARTY' }], elapsedMs: 1320, ...BASE }
const done = (result: VerifyResult): ReceiptCheck => ({ phase: 'done', result, at: NOW })

const noop = () => {}
const NAME = 'Irawanti Usada'

/**
 * Motion states wait for a trigger so screenshots can be taken at fixed offsets: dispatch
 * `window.dispatchEvent(new Event('saksi:trigger'))` (or press T). Before it, the "before" state renders.
 */
function useTrigger(): boolean {
  const [on, setOn] = useState(false)
  useEffect(() => {
    const go = () => setOn(true)
    const key = (e: KeyboardEvent) => {
      if (e.key === 't' || e.key === 'T') go()
    }
    window.addEventListener('saksi:trigger', go)
    window.addEventListener('keydown', key)
    return () => {
      window.removeEventListener('saksi:trigger', go)
      window.removeEventListener('keydown', key)
    }
  }, [])
  return on
}

/** A new receipt arrives at the top of the list (slide down 8px + fade + blue wash). */
function ArriveDemo() {
  const on = useTrigger()
  const [first, ...rest] = ALL
  const fresh: ReceiptOpening = { ...first, createdAt: new Date(NOW - 2_000).toISOString() }
  const receipts = on ? [fresh, ...rest] : rest
  return <ReceiptsSplit focus="list" list={<List receipts={receipts} freshIds={on ? [first.eventId] : []} />} pane={<SelectReceiptPane />} />
}

/** The phone's check flips one receipt to ALTERED: the row turns red and shakes, the pass flips to tamper. */
function TamperDemo({ phone }: { phone?: boolean }) {
  const on = useTrigger()
  return (
    <ReceiptsSplit
      focus="list"
      list={<List receipts={on ? WITH_TAMPER : ALL} verdicts={on ? ALTERED_V : MATCHED} />}
      pane={<SelectReceiptPane />}
      key={phone ? 'p' : 'l'}
    />
  )
}
function TamperSidebar() {
  const on = useTrigger()
  return <Sidebar path="/citizen" pass={on ? PASS_TAMPER : PASS_OK} />
}

/** Laptop keyboard: up/down move the selection; the pane cross-fades. */
function KeyboardDemo() {
  const [id, setId] = useState(ALL[1].eventId)
  const opening = ALL.find((r) => r.eventId === id) ?? ALL[1]
  return (
    <ReceiptsSplit
      focus="pane"
      paneKey={id}
      list={<List selectedId={id} onMove={setId} />}
      pane={<Detail opening={opening} verify={{ phase: 'done', result: MATCH }} check={done(MATCH)} />}
    />
  )
}


type PassLine = { verdict: PassVerdict; title: string }
const PASS_OK: PassLine = { verdict: 'ok', title: `All ${ALL.length} match the sealed record` }
const PASS_CHECKING: PassLine = { verdict: 'checking', title: 'Checking 2 receipts' }
const PASS_TAMPER: PassLine = { verdict: 'tamper', title: 'Tampering found' }
const PASS_EMPTY: PassLine = { verdict: 'empty', title: 'No receipts yet' }

function Sidebar({ path, code = CODE, watch = 'watching', count = ALL.length, pass = PASS_OK }: { path: string; code?: string; watch?: SidebarWatch; count?: number; pass?: PassLine }) {
  return <WorkspaceSidebarView path={path} code={code} watch={watch} count={count} verdict={pass.verdict} title={pass.title} onCopy={noop} name={NAME} />
}

function List(props: Partial<Parameters<typeof ReceiptListView>[0]>) {
  return <ReceiptListView state="ready" receipts={ALL} code={CODE} now={NOW} online watching freshIds={[]} verdicts={MATCHED} onCopy={noop} onRetry={noop} name={NAME} {...props} />
}

function Detail({ opening, verify, check }: { opening: ReceiptOpening; verify: DetailVerifyState; check?: ReceiptCheck }) {
  return (
    <ReceiptDetailView
      opening={opening}
      now={NOW}
      verify={verify}
      check={check}
      ai={{ state: 'idle' }}
      onVerify={noop}
      onExplain={noop}
      onShowLimits={noop}
      onDownload={noop}
      onShare={noop}
      onKeepEvidence={noop}
    />
  )
}

function Profile({ receipts = ALL, verdicts = MATCHED, confirm = 'closed' }: { receipts?: ReceiptOpening[]; verdicts?: AutoVerdicts; confirm?: ConfirmState }) {
  return (
    <ProfileScreenView
      state="ready"
      profile={{ code: CODE, displayName: NAME }}
      receipts={receipts}
      verdicts={verdicts}
      now={NOW}
      confirm={confirm}
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

function screen(s: WorkspaceState): { path: string; body: ReactNode; sidebar?: ReactNode } {
  switch (s) {
    case 'list':
      return { path: '/citizen', body: <ReceiptsSplit focus="list" list={<List freshIds={[ALL[0].eventId]} />} pane={<SelectReceiptPane />} /> }
    case 'checking':
      return { path: '/citizen', sidebar: <Sidebar path="/citizen" pass={PASS_CHECKING} />, body: <ReceiptsSplit focus="list" list={<List verdicts={CHECKING_V} />} pane={<SelectReceiptPane />} /> }
    case 'detail':
      return {
        path: '/citizen/receipt/x',
        body: <ReceiptsSplit focus="pane" list={<List selectedId={SHARE.eventId} />} pane={<Detail opening={SHARE} verify={{ phase: 'done', result: MATCH }} />} />,
      }
    case 'verify':
      return {
        path: '/citizen/receipt/x',
        body: <ReceiptsSplit focus="pane" list={<List selectedId={ALL[2].eventId} />} pane={<Detail opening={ALL[2]} verify={{ phase: 'idle' }} />} />,
      }
    case 'altered':
      return {
        path: '/citizen/receipt/x',
        sidebar: <Sidebar path="/citizen/receipt/x" pass={PASS_TAMPER} />,
        body: (
          <ReceiptsSplit
            focus="pane"
            list={<List receipts={WITH_TAMPER} verdicts={ALTERED_V} selectedId={SHARE.eventId} />}
            pane={<Detail opening={TAMPERED} verify={{ phase: 'done', result: EVENT_ALTERED }} check={done(EVENT_ALTERED)} />}
          />
        ),
      }
    case 'deleted':
      return { path: '/citizen', sidebar: <Sidebar path="/citizen" pass={PASS_TAMPER} />, body: <ReceiptsSplit focus="list" list={<List ghosts={[GHOST]} />} pane={<SelectReceiptPane />} /> }
    case 'empty':
      return {
        path: '/citizen',
        sidebar: <Sidebar path="/citizen" count={0} pass={PASS_EMPTY} />,
        body: <ReceiptsSplit focus="list" list={<List state="empty" receipts={[]} verdicts={{}} />} pane={<SelectReceiptPane count={0} />} />,
      }
    case 'loading':
      return {
        path: '/citizen',
        sidebar: <Sidebar path="/citizen" code="" watch="loading" />,
        body: <ReceiptsSplit focus="list" list={<List state="loading" receipts={[]} code="" verdicts={{}} />} pane={<SelectReceiptPane />} />,
      }
    case 'error':
      return {
        path: '/citizen',
        sidebar: <Sidebar path="/citizen" watch="paused" pass={{ verdict: 'empty', title: 'Receipts didn’t load' }} />,
        body: (
          <ReceiptsSplit
            focus="list"
            list={<List state="error" receipts={[]} verdicts={{}} watching={false} error="The Saksi server did not answer in time. Your receipts are safe on chain." />}
            pane={<SelectReceiptPane />}
          />
        ),
      }
    case 'onboarding':
      return { path: '/citizen', sidebar: <Sidebar path="/citizen" code="" watch="none" count={0} />, body: <OnboardingView status="idle" onCreateProfile={noop} /> }
    case 'profile':
      return { path: '/citizen/profile', body: <Profile /> }
    case 'profile-altered':
      return { path: '/citizen/profile', body: <Profile receipts={WITH_TAMPER} verdicts={{ ...ALTERED_V, [ALL[0].eventId]: 'verifying' }} /> }
    case 'profile-empty':
      return { path: '/citizen/profile', sidebar: <Sidebar path="/citizen/profile" count={0} pass={PASS_EMPTY} />, body: <Profile receipts={[]} verdicts={{}} /> }
    case 'profile-confirm':
      return { path: '/citizen/profile', body: <Profile confirm="open" /> }
    case 'firstrun':
      return { path: '/citizen', body: <ReceiptsSplit focus="list" list={<List sheet="welcome" />} pane={<SelectReceiptPane />} /> }
    case 'how':
      return { path: '/citizen', body: <ReceiptsSplit focus="list" list={<List sheet="how" />} pane={<SelectReceiptPane />} /> }
    case 'arrive':
      return { path: '/citizen', body: <ArriveDemo /> }
    case 'tamper-live':
      return { path: '/citizen', sidebar: <TamperSidebar />, body: <TamperDemo /> }
    case 'keyboard':
      return { path: '/citizen/receipt/x', body: <KeyboardDemo /> }
    case 'filtered':
      return { path: '/citizen', body: <FilteredDemo /> }
  }
}

export function CitizenWorkspaceGallery({ state }: { state: WorkspaceState | null }) {
  if (!state) {
    return (
      <main id="main" className="min-h-dvh bg-paper px-6 py-10">
        <h1 className="text-[36px] font-medium tracking-[-0.04em] text-ink">
          Citizen workspace <span className="text-ink-2">full screen.</span>
        </h1>
        <p className="mt-2 max-w-[80ch] text-[15px] text-ink-2">
          Each state renders in the real CitizenShell with fixtures from <code className="font-mono">mockWorkspaceReceipts()</code>. Open at
          ≥ 1024 px for the laptop workspace; below that the same URL shows the phone layout. Phone frames:{' '}
          <Link href="/dev/states/citizen" className="text-blue underline">
            /dev/states/citizen
          </Link>
          .
        </p>
        <ul className="mt-6 flex max-w-[640px] flex-col border-t border-line">
          {(Object.keys(WORKSPACE_STATES) as WorkspaceState[]).map((k) => (
            <li key={k} className="border-b border-line">
              <Link href={`/dev/states/citizen/workspace?s=${k}`} className="flex min-h-11 items-center justify-between gap-4 py-2 text-[15px] text-ink hover:text-blue">
                {WORKSPACE_STATES[k]}
                <span className="font-mono text-[12px] text-ink-2">?s={k}</span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    )
  }
  const { path, body, sidebar } = screen(state)
  return (
    <CitizenShell name={NAME} sidebar={sidebar ?? <Sidebar path={path} />}>
      {body}
    </CitizenShell>
  )
}

/** Filter pills: clicks the "Shared" pill after the trigger so the list fade can be filmed. */
function FilteredDemo() {
  const on = useTrigger()
  useEffect(() => {
    if (!on) return
    const pill = Array.from(document.querySelectorAll<HTMLButtonElement>('[aria-label="Filter receipts by what the agency did"] button')).find((b) =>
      b.textContent?.startsWith('Shared'),
    )
    pill?.click()
  }, [on])
  return <ReceiptsSplit focus="list" list={<List />} pane={<SelectReceiptPane />} />
}
