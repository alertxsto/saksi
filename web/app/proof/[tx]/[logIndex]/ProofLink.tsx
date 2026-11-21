'use client'

import { useParams } from 'next/navigation'
import { ButtonLink } from '@/components/ui/Button'
import { TwoTone } from '@/components/ui/Chip'
import { IconAlert } from '@/components/ui/icons'
import { RegMarks } from '@/components/ui/RegMarks'
import { Skeleton } from '@/components/ui/Skeleton'
import { decodeOpening } from '@/lib/format'
import { useHash } from '@/lib/hooks'
import { ProofResult } from '../../ProofResult'

/** /proof/[tx]/[logIndex]#<opening>. The opening is read from location.hash only — never sent to a server. */
export function ProofLink() {
  const { tx, logIndex } = useParams<{ tx: string; logIndex: string }>()
  const hash = useHash()

  if (hash === null) return <Skeleton className="h-96 w-full" />

  const opening = decodeOpening(hash)
  const consistent =
    opening && (opening.txHash ?? 'pending').toLowerCase() === tx.toLowerCase() && String(opening.logIndex ?? 0) === logIndex

  if (!opening || !consistent) return <ProofIncomplete mismatch={opening !== null} />

  return (
    <div className="flex flex-col gap-8">
      <div>
        <TwoTone head="A citizen shared this receipt." tail="Check it against the chain." className="text-[34px] md:text-[48px]" />
      </div>
      <ProofResult opening={opening} autoStart />
    </div>
  )
}

/** "This link is incomplete": the #fragment is missing, damaged, or names another transaction. Gray, never red. */
export function ProofIncomplete({ mismatch }: { mismatch: boolean }) {
  return (
    <div className="mx-auto flex max-w-[640px] flex-col gap-6">
      <section className="relative rounded-xl border-2 border-unknown/50 bg-unknown-bg p-6" role="alert">
        <RegMarks className="bg-unknown" size={8} />
        <span className="flex h-12 w-12 items-center justify-center rounded-md bg-unknown text-white">
          <IconAlert size={24} strokeWidth={2.2} />
        </span>
        <TwoTone
          as="h1"
          head="This link is incomplete."
          tail="Ask the citizen to share it again."
          className="mt-4 text-[28px] leading-[1.1]"
        />
        <p className="mt-3 text-[15px] leading-relaxed text-ink-2">
          {mismatch
            ? 'The receipt inside the link points to a different transaction than the address. Nothing was verified.'
            : 'The receipt details after “#” are missing or damaged, so there is nothing to compare. This says nothing about tampering.'}
        </p>
        <ButtonLink href="/proof" variant="dark" arrow className="mt-5">
          Open the verifier
        </ButtonLink>
      </section>
    </div>
  )
}
