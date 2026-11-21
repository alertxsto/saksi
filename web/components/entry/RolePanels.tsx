'use client'

import Link from 'next/link'
import type { CSSProperties, ReactNode } from 'react'
import { Button, ButtonLink } from '@/components/ui/Button'
import { IconCheck, IconCopy, IconRefresh, IconSpinner } from '@/components/ui/icons'
import { METAMASK_URL, type WalletView } from '@/components/ui/WalletGate'
import { CHAIN_NAME } from '@/lib/env'
import { shortHex } from '@/lib/format'
import { ROLE_META, type Actor } from './RoleChip'
import './entry.css'

/**
 * /enter role doors. Pure views: every state arrives through props (containers in ./EnterView.tsx,
 * fixtures in /dev/states/entry and /dev/states/controller/entry).
 *
 * Each door is a ticket (riset-ui/37 §4, the citizen stub): the top half says who the role is for and what
 * you will see; a perforation; the tear-off stub says which identity you get, what you need, and the action.
 */

type Tone = 'ok' | 'pending' | 'muted' | 'ink'
export type Row = { k: string; v: ReactNode; tone?: Tone }

const TONE: Record<Tone, string> = {
  ok: 'text-ok',
  pending: 'text-pending',
  muted: 'text-ink-3',
  ink: 'text-ink',
}

function Door({
  actor,
  device,
  title,
  sees,
  rows,
  actions,
  note,
  index,
}: {
  actor: Actor
  device: string
  title: string
  sees: string[]
  rows: Row[]
  actions: ReactNode
  note?: ReactNode
  index: number
}) {
  const meta = ROLE_META[actor]
  const id = `door-${actor}`
  return (
    <section
      id={actor}
      aria-labelledby={`${id}-name`}
      data-door={actor}
      className="en-door en-shadow min-w-0 scroll-mt-24"
      style={{ '--i': index, '--role': meta.accent } as CSSProperties}
    >
      <div className="flex h-full flex-col">
        <div className="en-half-top flex flex-1 flex-col bg-card px-5 pb-6 pt-5 md:px-6">
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className="en-door-disc">
              {meta.initial}
            </span>
            <h2 id={`${id}-name`} className="text-[17px] font-semibold tracking-[-0.01em] text-ink">
              {meta.label}
            </h2>
            <span className="ml-auto inline-flex h-7 items-center rounded-pill border border-line px-2.5 text-[13px] text-ink-2">
              {device}
            </span>
          </div>
          <p className="mt-5 text-[24px] font-semibold leading-[1.12] tracking-[-0.025em] text-ink md:text-[26px] lg:min-h-[58px]">
            {title}
          </p>
          <ul className="mt-4 flex flex-col gap-2">
            {sees.map((d) => (
              <li key={d} className="flex gap-2.5 text-[15px] leading-[1.45] text-ink-2">
                <IconCheck size={15} strokeWidth={2.4} className="mt-[3px] shrink-0 text-ink-3" />
                {d}
              </li>
            ))}
          </ul>
        </div>

        <div className="en-half-stub relative flex flex-col bg-card px-5 pb-5 pt-2 md:px-6 md:pb-6">
          <div aria-hidden="true" className="en-perf absolute inset-x-5 top-0 text-line-strong md:inset-x-6" />
          <dl className="flex flex-col">
            {rows.map((r, i) => (
              <div key={r.k} className={`flex min-h-11 items-center justify-between gap-4 ${i ? 'border-t border-line' : ''}`}>
                <dt className="shrink-0 text-[14px] text-ink-2">{r.k}</dt>
                <dd className={`min-w-0 py-2.5 text-right text-[14px] font-medium leading-[1.35] [overflow-wrap:anywhere] ${TONE[r.tone ?? 'ink']}`}>{r.v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 flex flex-col gap-2">{actions}</div>
          {note ? <div className="mt-3 text-[13px] leading-[1.5] text-ink-3">{note}</div> : null}
        </div>
      </div>
    </section>
  )
}

function Checking({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2">
      <IconSpinner size={12} />
      {children}
    </span>
  )
}

function Passed({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <IconCheck size={13} strokeWidth={3} className="shrink-0" />
      <span className="truncate">{children}</span>
    </span>
  )
}

// ── Citizen ─────────────────────────────────────────────────────────────────────────────────

export type CitizenSession =
  | { status: 'checking' }
  | { status: 'none' }
  | { status: 'unknown' }
  | { status: 'active'; code: string; name?: string }

export function CitizenPanel({
  session,
  creating = false,
  error,
  onCreateProfile,
  index = 0,
}: {
  session: CitizenSession
  creating?: boolean
  error?: string | null
  onCreateProfile: () => void
  index?: number
}) {
  const active = session.status === 'active'
  const who = active ? `${session.name ?? session.code} (synthetic)` : 'A new synthetic citizen'
  const device: Row =
    session.status === 'checking'
      ? { k: 'This phone', v: <Checking>Checking…</Checking>, tone: 'muted' }
      : active
        ? { k: 'This phone', v: <Passed>{`Code ${session.code}`}</Passed>, tone: 'ok' }
        : session.status === 'unknown'
          ? { k: 'This phone', v: 'Could not check', tone: 'muted' }
          : { k: 'This phone', v: 'No citizen yet', tone: 'muted' }

  return (
    <Door
      actor="citizen"
      index={index}
      device="Phone"
      title="See every time your data is opened"
      sees={['A receipt each time an agency opens your record.', 'Your phone checks it against the sealed record.']}
      rows={[{ k: 'You will be', v: who }, { k: 'You need', v: 'Nothing' }, device]}
      actions={
        active ? (
          <>
            <ButtonLink href="/citizen" variant="dark" arrow full>
              <span className="truncate">{`Continue as ${session.name ?? session.code}`}</span>
            </ButtonLink>
            <Button variant="ghost" size="sm" full loading={creating} disabled={creating} onClick={onCreateProfile} className="justify-center">
              {creating ? 'Starting a new citizen…' : 'Start as a new citizen'}
            </Button>
          </>
        ) : (
          <Button
            variant="dark"
            arrow
            full
            loading={creating}
            disabled={creating || session.status === 'checking'}
            onClick={onCreateProfile}
           
          >
            {creating ? 'Creating your citizen…' : 'Enter as a citizen'}
          </Button>
        )
      }
      note={
        <>
          {error ? (
            <p role="alert" className="mb-1.5 text-[14px] text-ink">
              {error}
            </p>
          ) : null}
          <p>No real person. In production you would sign in with the national digital ID (IKD).</p>
        </>
      }
    />
  )
}

// ── Agency (data controller) ────────────────────────────────────────────────────────────────

export function ControllerPanel({
  wallet,
  onConnect,
  onSwitchNetwork,
  onRefresh,
  onCopy,
  index = 1,
}: {
  wallet: WalletView
  onConnect: () => void
  onSwitchNetwork: () => void
  onRefresh: () => void
  onCopy: (text: string) => void
  index?: number
}) {
  const { state, isChecking, address, controller, isConnecting, isSwitching, error } = wallet
  const checking = Boolean(isChecking)
  const connected = state !== 'no_wallet' && state !== 'disconnected'
  const onChain = connected && state !== 'wrong_network'
  const registered = state === 'ready' || state === 'no_gas'

  const identity: Row = registered && !checking && controller?.name
    ? { k: 'You will be', v: controller.name }
    : { k: 'You will be', v: 'Disdukcapil Kota Contoh or RSUD Contoh (fiktif)' }

  const walletRow: Row =
    checking && !connected
      ? { k: 'Wallet', v: <Checking>Looking for MetaMask…</Checking>, tone: 'muted' }
      : state === 'no_wallet'
        ? { k: 'Wallet', v: 'MetaMask not found', tone: 'pending' }
        : !connected
          ? { k: 'Wallet', v: `MetaMask on ${CHAIN_NAME}`, tone: 'muted' }
          : state === 'wrong_network'
            ? { k: 'Wallet', v: `Not on ${CHAIN_NAME}`, tone: 'pending' }
            : { k: 'Wallet', v: <Passed>{`${shortHex(address, 6, 4)} · ${CHAIN_NAME}`}</Passed>, tone: 'ok' }

  const registryRow: Row = !onChain
    ? { k: 'Registry', v: 'Checked after you connect', tone: 'muted' }
    : checking
      ? { k: 'Registry', v: <Checking>Reading the registry…</Checking>, tone: 'muted' }
      : registered
        ? { k: 'Registry', v: <Passed>Registered agency</Passed>, tone: 'ok' }
        : { k: 'Registry', v: 'Not registered', tone: 'pending' }

  let actions: ReactNode
  if (checking) {
    actions = (
      <Button variant="dark" arrow full loading disabled>
        Checking your wallet…
      </Button>
    )
  } else if (state === 'no_wallet') {
    actions = (
      <ButtonLink href={METAMASK_URL} external variant="dark" arrow full>
        Install MetaMask
      </ButtonLink>
    )
  } else if (state === 'disconnected') {
    actions = (
      <Button variant="dark" arrow full loading={isConnecting} disabled={isConnecting} onClick={onConnect}>
        {isConnecting ? 'Waiting for MetaMask…' : 'Connect wallet'}
      </Button>
    )
  } else if (state === 'wrong_network') {
    actions = (
      <Button variant="dark" arrow full loading={isSwitching} disabled={isSwitching} onClick={onSwitchNetwork}>
        {isSwitching ? 'Confirm in MetaMask…' : `Switch to ${CHAIN_NAME}`}
      </Button>
    )
  } else if (state === 'not_registered') {
    actions = (
      <div className="flex gap-2 [&>*]:flex-1">
        <Button variant="light" size="sm" icon={<IconRefresh size={15} />} onClick={onRefresh} className="justify-center px-3">
          Check again
        </Button>
        {address ? (
          <Button variant="ghost" size="sm" icon={<IconCopy size={15} />} onClick={() => onCopy(address)} className="justify-center px-3">
            Copy address
          </Button>
        ) : null}
      </div>
    )
  } else {
    actions = (
      <ButtonLink href="/controller" variant="dark" arrow full>
        Open the agency workspace
      </ButtonLink>
    )
  }

  const note =
    state === 'not_registered' && !checking ? (
      <p>This address is not in the agency registry. Send it to the regulator, then check again.</p>
    ) : registered && !checking ? (
      <p>Your wallet address is your identity. No password, no account on Saksi.</p>
    ) : (
      <p>Best on a laptop. Saksi checks your address against the agency registry; no password.</p>
    )

  return (
    <Door
      actor="agency"
      index={index}
      device="Desktop"
      title="Record access to citizen data"
      sees={['Seal each time an officer opens a citizen record.', 'File a breach notice within 3×24 hours.']}
      rows={[identity, walletRow, registryRow]}
      actions={actions}
      note={
        <>
          {error ? (
            <p role="alert" className="mb-1.5 text-[14px] text-ink">
              {error}
            </p>
          ) : null}
          {note}
        </>
      }
    />
  )
}

// ── Regulator ───────────────────────────────────────────────────────────────────────────────

export function RegulatorPanel({ index = 2 }: { index?: number }) {
  return (
    <Door
      actor="regulator"
      index={index}
      device="Desktop"
      title="Supervise agencies and citizen reports"
      sees={['See late breach notices and records changed after sealing.', 'Read every citizen report, agency by agency.']}
      rows={[
        { k: 'You will be', v: 'PDP authority (simulated)' },
        { k: 'You need', v: 'Nothing' },
        { k: 'Access', v: 'Read-only' },
      ]}
      actions={
        <ButtonLink href="/regulator" variant="dark" arrow full>
          Open the regulator workspace
        </ButtonLink>
      }
      note={<p>Best on a laptop. The same sealed records anyone can check.</p>}
    />
  )
}

/** Quiet row under the doors: the public verifier for anyone else. */
export function AnyoneRow() {
  return (
    <p className="text-center text-[15px] text-ink-2">
      Not one of the three?{' '}
      <Link
        href="/proof"
        className="font-medium text-ink underline decoration-line-strong underline-offset-4 transition-colors duration-150 hover:decoration-ink"
      >
        Check a receipt without signing in
      </Link>
      <span className="mt-2 block text-[13px] text-ink-3">
        Presenter?{' '}
        <Link href="/operator" className="underline decoration-line underline-offset-4 transition-colors duration-150 hover:text-ink-2">
          Evidence room
        </Link>{' '}
        edits or deletes a sealed record to show the citizen&rsquo;s phone turning red.
      </span>
    </p>
  )
}
