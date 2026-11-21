'use client'

import { useParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Cta } from '@/components/landing/Cta'
import { NotFoundScreen } from '@/components/system/NotFoundScreen'
import { RequestedRef } from '@/components/system/RequestedRef'
import { SystemScreen } from '@/components/system/SystemScreen'
import { Skeleton } from '@/components/ui/Skeleton'
import { RiseHeading } from '@/components/regulator/Rise'
import { decodeOpening } from '@/lib/format'
import { useHash } from '@/lib/hooks'
import { ProofResult } from '../../ProofResult'

const LatticeObject = dynamic(() => import('@/components/landing/lattice/LatticeObject').then((m) => m.LatticeObject), {
  ssr: false,
  loading: () => <div className="aspect-square w-full" />,
})

const TX = /^(0x[0-9a-fA-F]{64}|pending)$/
const LOG = /^\d{1,6}$/

/**
 * /proof/[tx]/[logIndex]#<opening>. The opening is read from location.hash only — never sent to a server.
 * - the address itself can't name a sealed record (bad tx / log index): the shared 404 "Nothing sealed here."
 * - the receipt after "#" is missing, damaged or names another tx: "This link is incomplete." (gray)
 */
export function ProofLink() {
  const { tx, logIndex } = useParams<{ tx: string; logIndex: string }>()
  const hash = useHash()

  if (!TX.test(tx) || !LOG.test(logIndex)) return <NotFoundScreen kind="proof" chrome="embedded" />
  if (hash === null) return <Skeleton className="h-96 w-full" />

  const opening = decodeOpening(hash)
  const consistent =
    opening && (opening.txHash ?? 'pending').toLowerCase() === tx.toLowerCase() && String(opening.logIndex ?? 0) === logIndex

  if (!opening || !consistent) return <ProofIncomplete mismatch={opening !== null} />

  return (
    <div className="flex flex-col gap-10 md:gap-12">
      <RiseHeading
        as="h1"
        lead="A citizen shared this receipt."
        tail="Check it against the chain."
        className="text-[34px] leading-[1.04] md:text-[56px]"
      />
      <ProofResult opening={opening} autoStart />
    </div>
  )
}

/**
 * "This link is incomplete": the #fragment is missing, damaged, or names another transaction. Same layout as
 * the system screens (404 / reconnecting) so every dead end looks alike; gray, never red.
 */
export function ProofIncomplete({ mismatch }: { mismatch: boolean }) {
  return (
    <SystemScreen
      chrome="embedded"
      art={<LatticeObject shape="receipt" title="A receipt with its details missing" />}
      title="This link is incomplete."
      tail="Ask the citizen to share it again."
      body={
        mismatch
          ? 'The receipt inside the link points to a different transaction than the address. Nothing was verified.'
          : 'The receipt details after “#” are missing or damaged, so there is nothing to compare. This says nothing about tampering.'
      }
      meta={<RequestedRef label="Looked for" params={['tx', 'logIndex']} />}
      actions={
        <>
          <Cta href="/proof" className="justify-between max-sm:w-full">
            Open the verifier
          </Cta>
          <Cta href="/" variant="light" className="justify-center max-sm:w-full">
            Go home
          </Cta>
        </>
      }
    />
  )
}
