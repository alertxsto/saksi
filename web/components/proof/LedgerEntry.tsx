'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import type { Hex } from 'viem'
import { IconClock } from '@/components/ui/icons'
import { basisLabel, formatWIB, shortHex } from '@/lib/format'
import { ProofStamp } from './ProofStamp'
import { TechnicalProof } from './TechnicalProof'
import { hostOf } from './ProofStepper'
import '@/app/citizen/stub-ticket.css'
import './proof.css'

const VERB = ['Read', 'Updated', 'Exported', 'Shared']
const TAIL = ['a citizen’s data', 'a citizen’s data', 'a citizen’s data', 'a citizen’s data with a third party']
const ACTION = ['Read', 'Updated', 'Exported', 'Shared with a third party']

export type SealedEntry =
  | { status: 'found'; rpc: string; eventType: number; controllerId: Hex; legalBasisKey: Hex; pseudonym: Hex; blockNumber: number; blockTime: number | null; from: Hex; confirmations: number | null }
  | { status: 'missing'; rpc: string }

/**
 * Read-only: what the public ledger holds at tx + log index, with no receipt to compare. Decodes the journal's
 * AccessLogged event from the transaction receipt (the same checks as the verifier: right contract, live log).
 */
export async function readSealedEntry(tx: Hex, logIndex: number): Promise<SealedEntry> {
  const [{ getReceiptRobust, accessAbi, journalAddress, publicClient }, { decodeEventLog }] = await Promise.all([
    import('@/lib/shared/chain'),
    import('viem'),
  ])
  const { receipt, rpc } = await getReceiptRobust(tx)
  if (!receipt || receipt.status !== 'success' || !journalAddress) return { status: 'missing', rpc }
  const log = receipt.logs.find((l) => l.logIndex === logIndex)
  if (!log || log.removed || log.address.toLowerCase() !== journalAddress.toLowerCase()) return { status: 'missing', rpc }
  try {
    const { args } = decodeEventLog({ abi: accessAbi, eventName: 'AccessLogged', data: log.data, topics: log.topics })
    const [block, head] = publicClient
      ? await Promise.all([publicClient.getBlock({ blockNumber: receipt.blockNumber }), publicClient.getBlockNumber()]).catch(() => [null, null] as const)
      : ([null, null] as const)
    return {
      status: 'found',
      rpc,
      eventType: Number(args.eventType),
      controllerId: args.controllerId,
      legalBasisKey: args.legalBasisKey,
      pseudonym: args.subjectPseudonym,
      blockNumber: Number(receipt.blockNumber),
      blockTime: block ? Number(block.timestamp) : null,
      from: receipt.from,
      confirmations: head ? Number(head - receipt.blockNumber + 1n) : null,
    }
  } catch {
    return { status: 'missing', rpc }
  }
}

async function agencyName(controllerId: Hex, eoa: Hex): Promise<string | null> {
  const { findControllerName } = await import('@/lib/shared/chain')
  return (await findControllerName(controllerId, eoa).catch(() => undefined)) ?? null
}

/**
 * /proof/<tx>/<logIndex> opened without the receipt after "#". The ledger is still public, so the page shows
 * what was sealed there (agency, action, legal basis, time) and says plainly that nothing can be compared:
 * grey, no stamp, never red. `load` is injected by the /dev gallery.
 */
export function LedgerEntry({ tx, logIndex, load = readSealedEntry }: { tx: Hex; logIndex: number; load?: typeof readSealedEntry }) {
  const entry = useQuery({ queryKey: ['sealed-entry', tx, logIndex], queryFn: () => load(tx, logIndex), staleTime: 60_000, retry: 1 })
  const found = entry.data?.status === 'found' ? entry.data : null
  const name = useQuery({
    queryKey: ['agency-name', found?.controllerId, found?.from],
    queryFn: () => agencyName(found!.controllerId, found!.from),
    enabled: !!found && load === readSealedEntry,
    staleTime: Infinity,
  })
  const node = entry.data?.rpc ? hostOf(entry.data.rpc) : 'a public Sepolia node'
  const who = name.data ?? (found ? `Agency ${shortHex(found.controllerId)}` : '')

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <header className="max-w-[640px]">
        <h1 className="text-balance text-[28px] font-semibold leading-[1.1] tracking-[-0.02em] text-ink md:text-[34px]">
          This link has no receipt attached
        </h1>
        <p className="mt-2 text-[15px] leading-[1.6] text-ink-2 md:text-[16px]">
          The receipt travels after “#” in the link the citizen shares. Without it there is nothing to compare, so nothing is
          stamped. <span className="text-ink">This says nothing about tampering.</span>
        </p>
      </header>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-8">
        <div className="flex min-w-0 flex-col gap-4">
          {entry.isPending ? (
            <div aria-busy="true" className="h-[420px] animate-pulse rounded-lg bg-paper-2" />
          ) : found ? (
            <div className="-mx-2 overflow-x-clip px-2 pb-2">
              <div className="st-shadow relative">
                <article aria-labelledby="pf-entry-title">
                  <div className="st-half-top relative rounded-t-lg bg-card px-5 pb-6 pt-5 sm:px-6">
                    <div className="flex flex-col gap-4 pr-[84px] sm:pr-[104px]">
                      <p className="min-w-0 text-[13px] text-ink-2">
                        <span className="block text-[15px] font-semibold text-ink">{name.isPending && load === readSealedEntry ? 'Looking up the agency…' : who}</span>
                        Sealed on the public ledger{found.blockTime ? ` · ${formatWIB(found.blockTime * 1000)}` : ''}
                      </p>
                      <h2 id="pf-entry-title">
                        <span className="block text-[clamp(40px,12vw,56px)] font-semibold leading-[0.92] tracking-[-0.045em] text-ink">
                          {VERB[found.eventType] ?? 'Used'}
                        </span>
                        <span className="mt-1.5 block text-[19px] leading-tight tracking-[-0.01em] text-ink-2">{TAIL[found.eventType] ?? 'a citizen’s data'}.</span>
                      </h2>
                    </div>
                    <div className="absolute right-3 top-3 sm:right-4 sm:top-4">
                      <ProofStamp kind="awaiting" size={96} />
                    </div>
                    <span className="mt-4 inline-flex min-h-8 items-center gap-1.5 rounded-full bg-unknown-bg px-3 text-[14px] font-medium text-unknown">
                      <IconClock size={14} /> Nothing to compare
                    </span>
                    <span aria-hidden="true" className="st-perf absolute bottom-0 left-5 right-5 text-line-strong" />
                  </div>
                  <section aria-label="What the ledger sealed" className="st-half-bottom rounded-b-lg bg-card py-1.5">
                    <dl>
                      {[
                        ['Action', ACTION[found.eventType] ?? 'Unknown'],
                        ['Agency', who || '—'],
                        ['Legal basis', basisLabel(found.legalBasisKey)],
                        ['Purpose', 'Sealed as a fingerprint only'],
                        ['Citizen', `Pseudonym ${shortHex(found.pseudonym)}`],
                      ].map(([k, v]) => (
                        <div key={k} className="flex items-baseline justify-between gap-4 border-t border-line/70 px-5 py-3 first:border-t-0 sm:px-6">
                          <dt className="shrink-0 text-[14px] text-ink-2">{k}</dt>
                          <dd className="min-w-0 break-words text-right text-[14px] text-ink">{v}</dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                </article>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3 rounded-lg border border-line bg-unknown-bg/70 p-4">
              <IconClock size={18} className="mt-0.5 shrink-0 text-unknown" />
              <div className="min-w-0">
                <p className="text-[16px] font-semibold leading-snug text-ink">
                  {entry.isError ? 'The ledger did not answer' : 'No sealed entry here on this node yet'}
                </p>
                <p className="mt-1 text-[15px] leading-[1.55] text-ink-2">
                  <span className="text-ink">This is not proof of tampering.</span> The node may be slow, or the transaction may still be mining.
                </p>
              </div>
            </div>
          )}
          <div className="pf-sticky flex flex-col gap-2 sm:flex-row lg:static">
            <Link
              href="/proof"
              className="flex h-12 flex-1 items-center justify-center rounded-md bg-ink px-5 text-[16px] font-medium text-paper transition-colors duration-150 hover:bg-[#3a332c]"
            >
              Open the verifier
            </Link>
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-24">
          <div className="rounded-lg border border-line bg-card p-4 sm:p-5">
            <h2 className="text-[15px] font-semibold text-ink">To check this receipt</h2>
            <ol className="mt-3 flex flex-col gap-2.5 text-[14px] leading-snug text-ink-2">
              {['Ask the citizen to share the proof link again, in full.', 'Or open the receipt file they downloaded on /proof.', 'Your browser then compares every field with this entry.'].map((t, i) => (
                <li key={t} className="flex gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-line-strong text-[12px] font-semibold text-ink-3">{i + 1}</span>
                  <span className="pt-0.5">{t}</span>
                </li>
              ))}
            </ol>
          </div>
          <TechnicalProof
            txHash={tx}
            logIndex={logIndex}
            blockNumber={found?.blockNumber}
            confirmations={found?.confirmations ?? undefined}
            node={node}
          />
        </div>
      </div>
    </div>
  )
}
