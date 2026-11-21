'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import type { Hex } from 'viem'
import { LedgerEntry } from '@/components/proof/LedgerEntry'
import { NotFoundScreen } from '@/components/system/NotFoundScreen'
import { Skeleton } from '@/components/ui/Skeleton'
import { IconClock } from '@/components/ui/icons'
import { decodeOpening, shortHex } from '@/lib/format'
import { useHash } from '@/lib/hooks'
import { ProofResult } from '../../ProofResult'

const TX = /^(0x[0-9a-fA-F]{64}|pending)$/
const LOG = /^\d{1,6}$/

/**
 * /proof/[tx]/[logIndex]#<opening>. The opening is read from location.hash only — never sent to a server.
 * - the address itself can't name a sealed record (bad tx / log index): the shared 404 "Nothing sealed here."
 * - no "#" part at all: what the public ledger sealed at that address, with nothing to compare (grey).
 * - the receipt after "#" is damaged or names another tx: "This link is incomplete." (grey)
 */
export function ProofLink() {
  const { tx, logIndex } = useParams<{ tx: string; logIndex: string }>()
  const hash = useHash()

  if (!TX.test(tx) || !LOG.test(logIndex)) return <NotFoundScreen kind="proof" chrome="embedded" />
  if (hash === null) return <Skeleton className="h-96 w-full" />

  if (!hash.replace(/^#/, '') && tx !== 'pending') return <LedgerEntry tx={tx as Hex} logIndex={Number(logIndex)} />

  const opening = decodeOpening(hash)
  const consistent =
    opening && (opening.txHash ?? 'pending').toLowerCase() === tx.toLowerCase() && String(opening.logIndex ?? 0) === logIndex

  if (!opening || !consistent) return <ProofIncomplete mismatch={opening !== null} tx={tx} />

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <header className="max-w-[640px]">
        <h1 className="text-balance text-[28px] font-semibold leading-[1.1] tracking-[-0.02em] text-ink md:text-[34px]">
          A citizen shared this receipt
        </h1>
        <p className="mt-2 text-[15px] leading-[1.6] text-ink-2 md:text-[16px]">
          Your browser is checking it against the public ledger, field by field. Saksi’s server is not involved.
        </p>
      </header>
      <ProofResult opening={opening} autoStart />
    </div>
  )
}

/**
 * "This link is incomplete": the #fragment is damaged, or names another transaction. Grey, never red: a broken
 * link says nothing about tampering.
 */
export function ProofIncomplete({ mismatch, tx }: { mismatch: boolean; tx?: string }) {
  return (
    <div className="flex max-w-[640px] flex-col gap-6">
      <header>
        <h1 className="text-balance text-[28px] font-semibold leading-[1.1] tracking-[-0.02em] text-ink md:text-[34px]">This link is incomplete</h1>
        <p className="mt-2 text-[15px] leading-[1.6] text-ink-2 md:text-[16px]">Ask the citizen to share it again.</p>
      </header>
      <div className="flex items-start gap-3 rounded-lg border border-line bg-unknown-bg/70 p-4">
        <IconClock size={18} className="mt-0.5 shrink-0 text-unknown" />
        <div className="min-w-0">
          <p className="text-[16px] font-semibold leading-snug text-ink">Nothing was verified</p>
          <p className="mt-1 text-[15px] leading-[1.55] text-ink-2">
            {mismatch
              ? 'The receipt inside the link points to a different transaction than the address.'
              : 'The receipt details after “#” are damaged, so there is nothing to compare.'}{' '}
            <span className="text-ink">This says nothing about tampering.</span>
          </p>
          {tx ? <p className="mt-2 truncate font-mono text-[12px] text-ink-3">Looked for {shortHex(tx, 10, 8)}</p> : null}
        </div>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Link
          href="/proof"
          className="flex h-12 items-center justify-center rounded-md bg-ink px-6 text-[16px] font-medium text-paper transition-colors duration-150 hover:bg-[#3a332c]"
        >
          Open the verifier
        </Link>
        <Link
          href="/"
          className="flex h-12 items-center justify-center rounded-md border border-line-strong px-6 text-[16px] font-medium text-ink transition-colors duration-150 hover:border-ink"
        >
          Go home
        </Link>
      </div>
    </div>
  )
}
