'use client'

import Link from 'next/link'
import { Suspense } from 'react'
import type { Hex } from 'viem'
import { ProofHome } from '@/app/proof/ProofHome'
import { ProofResult } from '@/app/proof/ProofResult'
import { ProofIncomplete } from '@/app/proof/[tx]/[logIndex]/ProofLink'
import { LedgerEntry, type SealedEntry } from '@/components/proof/LedgerEntry'
import { ProofFrame } from '@/components/proof/ProofFrame'
import { fakeHex, MOCK_BLOCK_BASE, mockWorkspaceReceipts } from '@/lib/mock'
import type { ReceiptOpening, VerifyResult } from '@/lib/shared/types'
import { PROOF_STATES, type ProofState } from './states'

const NOW = Date.UTC(2026, 10, 21, 7, 3)
const ALL = mockWorkspaceReceipts(NOW, 'K7M2QD')
const SHARE = ALL.find((r) => r.eventId === 'evt_7Q2M4K') ?? ALL[0]
const OPENING: ReceiptOpening = { ...SHARE, txHash: SHARE.txHash ?? fakeHex('tx-share'), logIndex: SHARE.logIndex ?? 64 }
const TAMPERED: ReceiptOpening = { ...OPENING, eventType: 0 }
const EDITED: ReceiptOpening = { ...OPENING, eventType: 0, purposeText: 'Account review' }

const RPC = 'https://ethereum-sepolia-rpc.publicnode.com'
const SEALED_AT = Math.floor((NOW - 47 * 60_000) / 1000)
const BASE = { blockNumber: MOCK_BLOCK_BASE - 214, confirmations: 214, rpc: RPC }
const RESULTS: Record<string, VerifyResult> = {
  match: { status: 'MATCH', mismatches: [], elapsedMs: 1840, blockTime: SEALED_AT, ...BASE },
  altered: { status: 'MISMATCH', mismatches: [{ field: 'eventType', db: 'READ', chain: 'SHARE_THIRD_PARTY' }], elapsedMs: 1320, ...BASE },
  'altered-fields': {
    status: 'MISMATCH',
    mismatches: [
      { field: 'eventType', db: 'READ', chain: 'SHARE_THIRD_PARTY' },
      { field: 'purpose', db: fakeHex('purpose-db'), chain: fakeHex('purpose-chain') },
    ],
    elapsedMs: 1910,
    ...BASE,
  },
  notfound: { status: 'NOT_FOUND', mismatches: [], elapsedMs: 2410, rpc: RPC },
}

/** Mock node: answers after 700 ms so the stepper can be filmed; 'checking' never answers. */
function mockVerify(state: ProofState) {
  return () => {
    if (state === 'checking') return new Promise<VerifyResult>(() => {})
    if (state === 'error') return new Promise<VerifyResult>((_, no) => setTimeout(() => no(new Error('The node timed out after 4 s.')), 700))
    return new Promise<VerifyResult>((ok) => setTimeout(() => ok(RESULTS[state]), 700))
  }
}

const ENTRY: SealedEntry = {
  status: 'found',
  rpc: RPC,
  eventType: 3,
  controllerId: fakeHex('ctrl-contoh'),
  legalBasisKey: OPENING.legalBasisKey,
  pseudonym: OPENING.subjectPseudonym,
  blockNumber: BASE.blockNumber,
  blockTime: SEALED_AT,
  from: fakeHex('eoa', 20),
  confirmations: 214,
}

function State({ state }: { state: ProofState }) {
  if (state === 'home') return <ProofHome initialQuery="" />
  if (state === 'missing') return <ProofHome initialQuery={OPENING.txHash ?? ''} />
  if (state === 'incomplete') return <ProofIncomplete mismatch={false} tx={OPENING.txHash ?? undefined} />
  if (state === 'entry' || state === 'entry-missing') {
    const entry: SealedEntry = state === 'entry' ? ENTRY : { status: 'missing', rpc: RPC }
    return <LedgerEntry tx={(OPENING.txHash ?? fakeHex('tx')) as Hex} logIndex={OPENING.logIndex ?? 0} load={async () => entry} />
  }
  const opening = state === 'altered' ? TAMPERED : state === 'altered-fields' ? EDITED : OPENING
  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <header className="max-w-[640px]">
        <h1 className="text-balance text-[28px] font-semibold leading-[1.1] tracking-[-0.02em] text-ink md:text-[34px]">A citizen shared this receipt</h1>
        <p className="mt-2 text-[15px] leading-[1.6] text-ink-2 md:text-[16px]">
          Your browser is checking it against the public ledger, field by field. Saksi&apos;s server is not involved.
        </p>
      </header>
      <ProofResult key={state} opening={opening} autoStart verify={mockVerify(state)} />
    </div>
  )
}

export function ProofGallery({ state }: { state: ProofState | null }) {
  if (!state) {
    return (
      <main className="mx-auto max-w-[720px] px-4 py-10">
        <h1 className="text-[28px] font-semibold tracking-[-0.02em] text-ink">Proof states</h1>
        <ul className="mt-6 flex flex-col">
          {(Object.keys(PROOF_STATES) as ProofState[]).map((s) => (
            <li key={s} className="border-t border-line">
              <Link href={`/dev/states/proof?s=${s}`} className="flex min-h-12 items-center justify-between gap-3 text-[15px] text-ink hover:text-blue">
                <span className="font-mono text-[13px]">{s}</span>
                <span className="text-right text-ink-2">{PROOF_STATES[s]}</span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    )
  }
  return (
    <ProofFrame>
      <Suspense fallback={null}>
        <State state={state} />
      </Suspense>
    </ProofFrame>
  )
}
