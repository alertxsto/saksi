'use client'

import { useQuery } from '@tanstack/react-query'
import { useId, useState } from 'react'
import { ProofTicket } from '@/components/proof/ProofTicket'
import { ProofStepper } from '@/components/proof/ProofStepper'
import { TechnicalProof } from '@/components/proof/TechnicalProof'
import { useProofCheck, type ProofCheck } from '@/components/proof/useProofCheck'
import { IconClock, IconRefresh, IconShield } from '@/components/ui/icons'
import { getRpcNodes, verifyOnNode, type RpcNode } from '@/lib/data'
import { IDLE, type ReceiptCheck } from '@/lib/receipt-state'
import type { ReceiptOpening, VerifyResult } from '@/lib/shared/types'
import '@/components/proof/proof.css'

/**
 * The public check, shared by /proof and /proof/[tx]/[logIndex]: the receipt as a ticket, the four-step check
 * and the technical proof. Verification runs in this browser against the chosen RPC node; `verify` is only
 * passed by the /dev galleries (mock results). Switching node starts a fresh check.
 */
export function ProofResult({
  opening,
  autoStart,
  verify,
}: {
  opening: ReceiptOpening
  autoStart?: boolean
  verify?: (opening: ReceiptOpening, nodeId: string, attempt: number) => Promise<VerifyResult>
}) {
  const nodes = useQuery({ queryKey: ['rpc-nodes'], queryFn: getRpcNodes, staleTime: Infinity })
  const [node, setNode] = useState('0')
  const [run, setRun] = useState(0)
  const onSwitch = (id: string) => {
    setNode(id)
    setRun((r) => r + 1)
  }
  return (
    <ProofSession
      key={`${node}-${run}`}
      opening={opening}
      autoStart={autoStart || run > 0}
      nodes={nodes.data ?? []}
      node={node}
      onSwitch={onSwitch}
      run={(attempt) => (verify ? verify(opening, node, attempt) : verifyOnNode(opening, node))}
    />
  )
}

function toCheck(c: ProofCheck): ReceiptCheck {
  if (c.phase === 'running') return { phase: 'running' }
  if (c.phase === 'done' && c.result) return { phase: 'done', result: c.result, at: 0 }
  if (c.phase === 'error') return { phase: 'error', error: c.error ?? '', at: 0 }
  return IDLE
}

function ProofSession({
  opening,
  autoStart,
  nodes,
  node,
  onSwitch,
  run,
}: {
  opening: ReceiptOpening
  autoStart?: boolean
  nodes: RpcNode[]
  node: string
  onSwitch: (id: string) => void
  run: (attempt: number) => Promise<VerifyResult>
}) {
  const check = useProofCheck({ run, autoStart })
  const host = nodes.find((n) => n.id === node)?.label ?? 'a public Sepolia node'
  const ticketCheck = toCheck(check)
  const result = check.phase === 'done' ? check.result : null
  const selectId = useId()
  const label = check.phase === 'idle' ? 'Check against the ledger' : check.phase === 'running' ? 'Checking…' : 'Check again'

  const action = (
    <button
      type="button"
      onClick={check.start}
      disabled={check.phase === 'running'}
      className="flex h-12 w-full items-center justify-center gap-2.5 rounded-md bg-ink px-5 text-[16px] font-medium text-paper transition-colors duration-150 hover:bg-[#3a332c] disabled:cursor-progress disabled:opacity-60"
    >
      {check.phase === 'idle' ? <IconShield size={17} /> : <IconRefresh size={16} />}
      {label}
    </button>
  )

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-8">
      {/* Right on desktop, first on the phone: the check, as it runs. */}
      <section aria-labelledby="pf-steps" className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-24 lg:col-start-2 lg:row-start-1">
        <div className="rounded-lg border border-line bg-card px-4 pb-4 pt-4 sm:px-5">
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <h2 id="pf-steps" className="text-[15px] font-semibold text-ink">
              The check
            </h2>
            <p className="text-[13px] text-ink-3">In your browser</p>
          </div>
          <ProofStepper check={check} opening={opening} node={host} />
          {nodes.length > 1 ? (
            <div className="mt-4 flex items-center gap-2 border-t border-line pt-3">
              <label htmlFor={selectId} className="shrink-0 text-[13px] text-ink-2">
                Don’t trust this node?
              </label>
              <select
                id={selectId}
                value={node}
                onChange={(e) => onSwitch(e.target.value)}
                disabled={check.phase === 'running'}
                className="h-9 min-w-0 flex-1 truncate rounded-md border border-line-strong bg-paper px-2 font-mono text-[12px] text-ink focus-visible:outline-2 focus-visible:outline-blue"
              >
                {nodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="mt-4 hidden lg:block">{action}</div>
        </div>
        <div className="hidden lg:block">
          <TechnicalProof
            txHash={opening.txHash}
            logIndex={opening.logIndex}
            blockNumber={result?.blockNumber}
            confirmations={result?.confirmations}
            node={host}
            raw={rawFields(opening)}
          />
        </div>
      </section>

      <div className="flex min-w-0 flex-col gap-4 lg:col-start-1 lg:row-start-1">
        <ProofTicket opening={opening} check={ticketCheck} />
        <div aria-live="polite">
          <Verdict check={check} host={host} canSwitch={nodes.length > 1} />
        </div>
        <div className="lg:hidden">
          <TechnicalProof
            txHash={opening.txHash}
            logIndex={opening.logIndex}
            blockNumber={result?.blockNumber}
            confirmations={result?.confirmations}
            node={host}
            raw={rawFields(opening)}
          />
        </div>
        <div className="pf-sticky lg:hidden">{action}</div>
      </div>
    </div>
  )
}

function rawFields(o: ReceiptOpening): Record<string, unknown> {
  return {
    txHash: o.txHash,
    logIndex: o.logIndex,
    eventType: o.eventType,
    legalBasisKey: o.legalBasisKey,
    subjectPseudonym: o.subjectPseudonym,
    purposeText: o.purposeText,
    purposeSalt: o.purposeSalt,
    evidence: o.evidence,
  }
}

const secs = (ms: number) => (ms / 1000).toFixed(1)

/** The readable verdict under the ticket (the stamp is decorative; this line carries it). */
function Verdict({ check, host, canSwitch }: { check: ProofCheck; host: string; canSwitch: boolean }) {
  if (check.phase === 'error') {
    return (
      <div role="alert" className="pf-rise flex items-start gap-3 rounded-lg border border-line bg-unknown-bg/70 p-4">
        <IconClock size={18} className="mt-0.5 shrink-0 text-unknown" />
        <p className="text-[15px] leading-[1.55] text-ink-2">
          <span className="font-semibold text-ink">The ledger did not answer.</span> {check.error || 'Check your connection.'} Nothing was decided.
        </p>
      </div>
    )
  }
  const r = check.phase === 'done' ? check.result : null
  if (!r) return null
  if (r.status === 'MATCH') {
    return (
      <div className="pf-rise px-1">
        <p className="text-[19px] font-semibold leading-snug tracking-[-0.01em] text-ink">
          Matches the sealed record. <span className="text-ink-2">Nothing changed since the ledger sealed it.</span>
        </p>
        <p className="mt-1.5 text-[13px] text-ink-3">
          Checked in your browser in {secs(r.elapsedMs)} s, not by Saksi’s server · {host}
        </p>
      </div>
    )
  }
  if (r.status === 'MISMATCH') {
    const n = r.mismatches.length
    return (
      <div className="pf-rise px-1">
        <p className="text-[19px] font-semibold leading-snug tracking-[-0.01em] text-ink">
          <span className="text-bad">Changed after sealing.</span>{' '}
          <span className="text-ink-2">
            {n === 1 ? 'One field no longer matches' : `${n} fields no longer match`} what the ledger sealed.
          </span>
        </p>
        <p className="mt-1.5 text-[13px] text-ink-3">
          Checked in your browser in {secs(r.elapsedMs)} s, not by Saksi’s server · {host}
        </p>
      </div>
    )
  }
  return (
    <div className="pf-rise flex items-start gap-3 rounded-lg border border-line bg-unknown-bg/70 p-4">
      <IconClock size={18} className="mt-0.5 shrink-0 text-unknown" />
      <div className="min-w-0">
        <p className="text-[16px] font-semibold leading-snug text-ink">Not found on this node yet</p>
        <p className="mt-1 text-[15px] leading-[1.55] text-ink-2">
          <span className="text-ink">This is not proof of tampering.</span> The node may be slow, or the transaction may still be
          mining. {canSwitch ? 'Try another node above, or check again in a moment.' : 'Check again in a moment.'}
        </p>
      </div>
    </div>
  )
}
