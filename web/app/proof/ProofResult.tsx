'use client'

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Chip } from '@/components/ui/Chip'
import { IconExternal, IconShield } from '@/components/ui/icons'
import { LedgerReceipt } from '@/components/ui/LedgerReceipt'
import { VerifyPanel } from '@/components/ui/VerifyResult'
import { explorerLink, getRpcNodes, verifyOnNode } from '@/lib/data'
import { EXPLORER_CAPTION } from '@/components/regulator/explorer'
import { actSentence } from '@/lib/format'
import { IDLE, receiptHeadline, verdictKind, type ReceiptCheck } from '@/lib/receipt-state'
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
  // The link's contents are untrusted until this browser has checked them: no status badge before a verdict.
  const [check, setCheck] = useState<ReceiptCheck>(IDLE)
  const head = receiptHeadline(opening, check)
  const verdict = verdictKind(check)

  const onVerify = (attempt: number) => (verify ? verify(opening, node, attempt) : verifyOnNode(opening, node))
  const onSwitchRpc = (id: string) => {
    setNode(id)
    setCheck(IDLE)
    setRun((r) => r + 1)
  }

  return (
    <div className="anim-rise grid gap-10 lg:grid-cols-12">
      <div className="flex flex-col gap-5 lg:col-span-7">
        {head.claimed ? (
          <p role="alert" className="rounded-lg border-2 border-bad bg-bad-bg p-3 text-[15px] leading-snug text-ink">
            <span className="label block text-[11px] font-bold text-bad">The chain disagrees with this receipt</span>
            <span className="mt-1 block">
              {head.who} <strong className="font-semibold text-bad">{head.act}</strong>. The receipt says{' '}
              <span className="line-through decoration-bad decoration-2">{actSentence(opening.eventType)}</span>.
            </span>
          </p>
        ) : null}
        <LedgerReceipt
          opening={opening}
          check={check}
          header={
            <div className="flex items-center justify-between gap-2">
              <span className="label min-w-0 truncate text-ink">Receipt · {opening.eventId}</span>
              {verdict ? (
                <Badge kind={verdict} size="sm" />
              ) : (
                <Chip icon={<IconShield size={12} />}>Opened from link</Chip>
              )}
            </div>
          }
        />
        <VerifyPanel
          key={`${node}-${run}`}
          opening={opening}
          autoStart={autoStart || run > 0}
          run={onVerify}
          onCheck={setCheck}
        />
      </div>

      <aside className="flex flex-col gap-6 self-start lg:sticky lg:top-24 lg:col-span-5">
        <section aria-labelledby="node-pick">
          <h2 id="node-pick" className="text-[19px] font-medium tracking-[-0.015em] text-ink md:text-[22px]">
            Don’t trust us <span className="text-ink-2">· pick another node</span>
          </h2>
          <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">The same record, read through someone else’s RPC node. Switching runs the check again.</p>
          <fieldset className="mt-4 border-b border-line" disabled={!nodes.data?.length}>
            <legend className="sr-only">RPC node</legend>
            {nodes.data?.length ? (
              nodes.data.map((n) => {
                const on = n.id === node
                return (
                  <label
                    key={n.id}
                    className={`group relative -mx-3 flex min-h-12 cursor-pointer items-center gap-3 rounded-md border-t border-line px-3 transition-colors duration-200 first:border-t-0 ${
                      on ? 'bg-card' : 'hover:bg-card/60'
                    }`}
                  >
                    <input type="radio" name="rpc" value={n.id} checked={on} onChange={() => onSwitchRpc(n.id)} className="peer sr-only" />
                    <span
                      aria-hidden="true"
                      className={`flex size-[18px] shrink-0 items-center justify-center rounded-full border transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-blue ${
                        on ? 'border-ink' : 'border-line-strong group-hover:border-ink-3'
                      }`}
                    >
                      {on ? <span className="size-2 rounded-full bg-blue" /> : null}
                    </span>
                    <span className={`min-w-0 flex-1 truncate font-mono text-[14px] ${on ? 'text-ink' : 'text-ink-2'}`}>{n.label}</span>
                    {on ? <span className="label text-[11px] text-ink-3">In use</span> : null}
                  </label>
                )
              })
            ) : (
              <p className="flex min-h-12 items-center gap-3 border-t border-line font-mono text-[14px] text-ink-2">
                <span aria-hidden="true" className="size-[18px] rounded-full border border-dashed border-line-strong" />
                {nodes.isPending ? 'Loading nodes…' : 'No RPC node configured'}
              </p>
            )}
          </fieldset>
        </section>

        <details className="group overflow-hidden rounded-lg border border-line bg-card">
          <summary className="label flex min-h-12 cursor-pointer list-none items-center justify-between px-4 text-ink hover:text-blue">
            Raw log · what your browser compares
            <span aria-hidden="true" className="text-[16px] transition-transform duration-200 group-open:rotate-45">+</span>
          </summary>
          <pre className="max-h-72 overflow-auto border-t border-line bg-vault p-4 font-mono text-[11px] leading-relaxed text-vault-ink">
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
            className="group flex min-h-12 items-center justify-between gap-3 border-y border-line text-ink transition-colors hover:text-blue"
          >
            <span className="flex flex-col">
              <span className="label">Open the transaction</span>
              <span className="font-mono text-[11px] text-ink-3">{EXPLORER_CAPTION}</span>
            </span>
            <IconExternal size={15} className="transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </a>
        ) : null}
        <p className="label text-[11px] leading-relaxed text-ink-2">
          The receipt details stay in the link after “#”. Browsers never send that part to any server.
        </p>
      </aside>
    </div>
  )
}
