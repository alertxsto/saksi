'use client'

import Link from 'next/link'
import type { CSSProperties, ReactNode } from 'react'
import { Button, ButtonLink } from '@/components/ui/Button'
import { DotIcon, type DotIconName } from '@/components/ui/DotIcon'
import { IconCheck, IconCopy, IconRefresh, IconSpinner } from '@/components/ui/icons'
import { METAMASK_URL, type WalletView } from '@/components/ui/WalletGate'
import { CHAIN_NAME } from '@/lib/env'
import { shortHex } from '@/lib/format'

/**
 * /enter role panels. Pure views: every state arrives through props (containers in ./EnterView.tsx,
 * fixtures in /dev/states/controller/entry). One panel per party, same anatomy so the three line up:
 * dot glyph + sign-in chip, role name + who it is for, what you do there, then (pinned to the bottom)
 * how you sign in as three key/value rows and one action row.
 */

type Tone = 'ok' | 'pending' | 'muted' | 'ink'
export type Row = { k: string; v: ReactNode; tone?: Tone }

const TONE: Record<Tone, string> = {
  ok: 'text-ok',
  pending: 'text-pending',
  muted: 'text-ink-3',
  ink: 'text-ink',
}

function Panel({
  id,
  glyph,
  chip,
  name,
  who,
  does,
  signIn,
  rows,
  actions,
  note,
  index,
}: {
  id: string
  glyph: DotIconName
  chip: string
  name: string
  who: string
  does: string[]
  signIn: ReactNode
  rows: Row[]
  actions: ReactNode
  note?: ReactNode
  index: number
}) {
  return (
    <section
      aria-labelledby={`${id}-name`}
      className="en-panel flex min-w-0 flex-col rounded-xl border border-line bg-card p-6 md:p-7"
      style={{ '--i': index } as CSSProperties}
    >
      <div className="flex items-center gap-4">
        <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-md bg-paper-2 text-ink">
          <DotIcon name={glyph} size={20} />
        </span>
        <h2 id={`${id}-name`} className="text-[26px] font-medium leading-[1.1] tracking-[-0.02em] text-ink md:text-[28px]">
          {name}
        </h2>
      </div>
      <p className="mt-4 text-[16px] leading-[1.5] tracking-[0.01em] text-ink-2 md:text-[17px] lg:min-h-[51px]">{who}</p>

      <ul className="mt-5 flex flex-col gap-2 border-t border-line pt-5">
        {does.map((d) => (
          <li key={d} className="flex gap-3 text-[15px] leading-[1.5] text-ink">
            <IconCheck size={15} strokeWidth={2.4} className="mt-[3px] shrink-0 text-ink-3" />
            {d}
          </li>
        ))}
      </ul>

      <div className="mt-auto flex flex-col pt-8">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-[15px] font-medium tracking-[0.005em] text-ink">How you sign in</h3>
          <span className="label inline-flex h-6 items-center whitespace-nowrap rounded-pill border border-line-strong px-2.5 text-[11px] text-ink-2">
            {chip}
          </span>
        </div>
        <p className="mt-1.5 text-[14px] leading-[1.55] text-ink-2">{signIn}</p>
        <dl className="mt-4 flex flex-col">
          {rows.map((r) => (
            <div key={r.k} className="flex min-h-10 items-center justify-between gap-4 border-t border-line">
              <dt className="label text-[11px] text-ink-3">{r.k}</dt>
              <dd className={`min-w-0 truncate text-right font-mono text-[13px] ${TONE[r.tone ?? 'ink']}`}>{r.v}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-5 flex flex-wrap gap-2.5 [&>*]:min-w-0 [&>*:first-child]:flex-1">{actions}</div>
        {note ? <div className="mt-4 text-[13px] leading-[1.55] text-ink-2">{note}</div> : null}
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
      <IconCheck size={12} strokeWidth={3} className="shrink-0" />
      <span className="truncate">{children}</span>
    </span>
  )
}

// ── Citizen ──────────────────────────────────────────────────────────────────────────────────────

export type CitizenSession =
  | { status: 'checking' }
  | { status: 'none' }
  | { status: 'unknown' }
  | { status: 'active'; code: string }

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
  const device: Row =
    session.status === 'checking'
      ? { k: 'This device', v: <Checking>Checking…</Checking>, tone: 'muted' }
      : session.status === 'active'
        ? { k: 'This device', v: <Passed>Profile {session.code}</Passed>, tone: 'ok' }
        : session.status === 'unknown'
          ? { k: 'This device', v: 'Could not check', tone: 'muted' }
          : { k: 'This device', v: 'No profile yet', tone: 'muted' }
  return (
    <Panel
      id="citizen"
      index={index}
      glyph="eye"
      chip="Demo profile"
      name="Citizen"
      who="The person the data is about."
      does={['See each time an agency or company opens your data.', 'Check every receipt against the chain, in your own browser.']}
      signIn="No wallet, no name, no ID number. One tap makes a synthetic profile on this device."
      rows={[
        { k: 'Identity', v: 'Synthetic profile' },
        { k: 'You need', v: 'Nothing' },
        device,
      ]}
      actions={
        session.status === 'active' ? (
          <ButtonLink href="/citizen" variant="dark" arrow>
            {`Continue as ${session.code}`}
          </ButtonLink>
        ) : (
          <Button
            variant="dark"
            arrow
            loading={creating}
            disabled={creating || session.status === 'checking'}
            onClick={onCreateProfile}
          >
            {creating ? 'Creating your profile…' : 'Create a demo profile'}
          </Button>
        )
      }
      note={
        <>
          {error ? <p className="mb-2 text-ink">{error}</p> : null}
          <p>In production, citizens sign in with the national digital ID (IKD). This demo uses a synthetic profile.</p>
        </>
      }
    />
  )
}

// ── Data controller ──────────────────────────────────────────────────────────────────────────────

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

  const rows: Row[] = [
    checking && !connected
      ? { k: 'Wallet', v: <Checking>Looking for MetaMask…</Checking>, tone: 'muted' }
      : state === 'no_wallet'
        ? { k: 'Wallet', v: 'MetaMask not found', tone: 'pending' }
        : !connected
          ? { k: 'Wallet', v: 'Not connected', tone: 'pending' }
          : { k: 'Wallet', v: <Passed>{shortHex(address, 6, 4)}</Passed>, tone: 'ok' },
    !connected
      ? { k: 'Network', v: CHAIN_NAME, tone: 'muted' }
      : state === 'wrong_network'
        ? { k: 'Network', v: `Not on ${CHAIN_NAME}`, tone: 'pending' }
        : { k: 'Network', v: <Passed>{CHAIN_NAME}</Passed>, tone: 'ok' },
    !onChain
      ? { k: 'Registry', v: 'Not checked yet', tone: 'muted' }
      : checking
        ? { k: 'Registry', v: <Checking>Reading the registry…</Checking>, tone: 'muted' }
        : registered
          ? { k: 'Registry', v: <Passed>{controller?.name ?? 'Registered'}</Passed>, tone: 'ok' }
          : { k: 'Registry', v: 'Not registered', tone: 'pending' },
  ]

  let actions: ReactNode
  if (checking) {
    actions = (
      <Button variant="dark" arrow loading disabled>
        Checking your wallet…
      </Button>
    )
  } else if (state === 'no_wallet') {
    actions = (
      <ButtonLink href={METAMASK_URL} external variant="dark" arrow>
        Install MetaMask
      </ButtonLink>
    )
  } else if (state === 'disconnected') {
    actions = (
      <Button variant="dark" arrow loading={isConnecting} disabled={isConnecting} onClick={onConnect}>
        {isConnecting ? 'Waiting for MetaMask…' : 'Connect wallet'}
      </Button>
    )
  } else if (state === 'wrong_network') {
    actions = (
      <Button variant="dark" arrow loading={isSwitching} disabled={isSwitching} onClick={onSwitchNetwork}>
        {isSwitching ? 'Confirm in MetaMask…' : `Switch to ${CHAIN_NAME}`}
      </Button>
    )
  } else if (state === 'not_registered') {
    actions = (
      <>
        <Button variant="light" icon={<IconRefresh size={15} />} onClick={onRefresh}>
          Check again
        </Button>
        {address ? (
          <Button variant="ghost" icon={<IconCopy size={15} />} onClick={() => onCopy(address)}>
            Copy address
          </Button>
        ) : null}
      </>
    )
  } else {
    actions = (
      <ButtonLink href="/controller" variant="dark" arrow>
        Open console
      </ButtonLink>
    )
  }

  const note =
    state === 'not_registered' && !checking ? (
      <p>This address is not in the registry. Send it to the regulator to be registered, then check again.</p>
    ) : registered && !checking ? (
      <p>
        Signed in as <span className="text-ink">{controller?.name}</span>. Your address is the identity; the registry contract is
        the list.
      </p>
    ) : (
      <p>Decentralized sign-in: no password and no account on our server. The contract decides who may seal.</p>
    )

  return (
    <Panel
      id="controller"
      index={index}
      glyph="edit"
      chip="Wallet sign-in"
      name="Data controller"
      who="A government agency or company that holds personal data."
      does={['Record each access to a citizen’s data, sealed on chain.', 'File a breach notice inside the 72-hour window.']}
      signIn={`Connect MetaMask. Saksi checks your address against the ControllerRegistry contract on ${CHAIN_NAME}.`}
      rows={rows}
      actions={actions}
      note={
        <>
          {error ? <p className="mb-2 text-ink">{error}</p> : null}
          {note}
        </>
      }
    />
  )
}

// ── Regulator ────────────────────────────────────────────────────────────────────────────────────

export function RegulatorPanel({ index = 2 }: { index?: number }) {
  return (
    <Panel
      id="regulator"
      index={index}
      glyph="shield"
      chip="Open · read-only"
      name="Regulator"
      who="The data protection authority."
      does={['See which breach notices came in late, decided by the contract.', 'Watch the database and the chain side by side, live.']}
      signIn="Nothing to sign. The regulator view is open by design, so anyone can audit what the regulator sees."
      rows={[
        { k: 'Access', v: 'Open to anyone' },
        { k: 'You need', v: 'Nothing' },
        { k: 'Source', v: <Passed>{`${CHAIN_NAME} contracts`}</Passed>, tone: 'ok' },
      ]}
      actions={
        <>
          <ButtonLink href="/regulator" variant="dark" arrow>
            Breach notices
          </ButtonLink>
          <ButtonLink href="/regulator/watch" variant="light">
            Watch
          </ButtonLink>
        </>
      }
      note={<p>Same records the public can check, read straight from the chain.</p>}
    />
  )
}

/** Quiet footer row under the panels: the public verifier for anyone else. */
export function AnyoneRow() {
  return (
    <div className="flex flex-col gap-4 border-t border-line pt-6 md:flex-row md:items-center md:justify-between">
      <p className="text-[15px] text-ink-2">
        Not one of the three?{' '}
        <Link href="/proof" className="font-medium text-ink underline decoration-line-strong underline-offset-4 transition-colors duration-150 hover:decoration-ink">
          Anyone: check a receipt
        </Link>
      </p>
      <p className="label text-[11px] text-ink-3">All three read the same contracts on {CHAIN_NAME}</p>
    </div>
  )
}
