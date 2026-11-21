'use client'

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Chip } from '@/components/ui/Chip'
import { IconExternal, IconShield } from '@/components/ui/icons'
import { LedgerReceipt } from '@/components/ui/LedgerReceipt'
import { VerifyPanel } from '@/components/ui/VerifyResult'
import { explorerLink, getRpcNodes, verifyOnNode } from '@/lib/data'
import type { ReceiptOpening, VerifyResult } from '@/lib/shared/types'

/**
 * Ledger + Verify + "Don't trust us" panel, shared by /proof and /proof/[tx]/[logIndex]. Verification runs
 * in this browser against the chosen RPC node; `verify` is only passed by the /dev gallery (mock results).
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

  const onVerify = (attempt: number) => (verify ? verify(opening, node, attempt) : verifyOnNode(opening, node))
  const onSwitchRpc = (id: string) => {
    setNode(id)
    setRun((r) => r + 1)
  }

  return (
    <div className="grid gap-8 lg:grid-cols-12">
      <div className="flex flex-col gap-5 lg:col-span-7">
        <LedgerReceipt
          opening={opening}
          header={
            <div className="flex items-center justify-between gap-2">
              <span className="label text-ink">Receipt · {opening.eventId}</span>
              <Chip icon={<IconShield size={12} />}>Opened from link</Chip>
            </div>
          }
        />
        <VerifyPanel
          key={`${node}-${run}`}
          opening={opening}
          autoStart={autoStart || run > 0}
          run={onVerify}
        />
      </div>

      <aside className="flex flex-col gap-4 lg:col-span-5">
        <section className="overflow-hidden rounded-lg border border-line bg-card">
          <div className="border-b border-line px-5 py-3">
            <p className="label text-ink">Don’t trust us</p>
            <p className="mt-1 text-[14px] text-ink-2">Check the same record through someone else’s node.</p>
          </div>
          <div className="flex flex-col gap-4 p-5">
            <div>
              <label htmlFor="rpc" className="label text-ink-2">
                Switch RPC node
              </label>
              <select
                id="rpc"
                value={node}
                disabled={!nodes.data?.length}
                onChange={(e) => onSwitchRpc(e.target.value)}
                className="mt-2 h-12 w-full rounded-md border border-line-strong bg-paper-2 px-3 font-mono text-[14px] text-ink outline-none focus:border-blue"
              >
                {nodes.data?.length ? (
                  nodes.data.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.label}
                    </option>
                  ))
                ) : (
                  <option value="0">{nodes.isPending ? 'Loading nodes…' : 'No RPC node configured'}</option>
                )}
              </select>
            </div>
            <details className="group overflow-hidden rounded-lg border border-line">
              <summary className="label flex min-h-11 cursor-pointer list-none items-center justify-between px-3 text-ink hover:text-blue">
                Raw log · what your browser compares
                <span aria-hidden="true" className="transition-transform group-open:rotate-45">+</span>
              </summary>
              <pre className="max-h-72 overflow-auto border-t border-line bg-vault p-3 font-mono text-[11px] leading-relaxed text-vault-ink">
                {JSON.stringify(
                  {
                    txHash: opening.txHash,
                    logIndex: opening.logIndex,
                    eventType: opening.eventType,
                    legalBasisKey: opening.legalBasisKey,
                    subjectPseudonym: opening.subjectPseudonym,
                    purposeText: opening.purposeText,
                    purposeSalt: opening.purposeSalt,
                    evidence: opening.evidence,
                  },
                  null,
                  2,
                )}
              </pre>
            </details>
            {opening.txHash ? (
              <a
                href={explorerLink('tx', opening.txHash)}
                target="_blank"
                rel="noreferrer"
                className="label flex min-h-11 items-center justify-between rounded-md border border-line px-3 text-ink hover:border-ink hover:text-blue"
              >
                Open transaction on Etherscan <IconExternal size={15} />
              </a>
            ) : null}
          </div>
        </section>
        <p className="label text-[11px] leading-relaxed text-ink-2">
          The receipt details stay in the link after “#”. Browsers never send that part to any server.
        </p>
      </aside>
    </div>
  )
}
