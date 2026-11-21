'use client'

import { copyText, explorerLink } from '@/lib/data'
import { shortHex } from '@/lib/format'
import { IconArrowUpRight, IconCopy } from './icons'
import { useToast } from './Toast'

/** Shortened fingerprint (tx hash) + copy + explorer link (NEXT_PUBLIC_EXPLORER_URL). Buttons are 44px touch targets. */
export function FingerprintChip({
  value,
  kind = 'tx',
  onVault,
  label = 'fingerprint',
}: {
  value: string | null
  kind?: 'tx' | 'address' | 'none'
  onVault?: boolean
  label?: string
}) {
  const { toast } = useToast()
  if (!value) return <span className="font-mono text-[13px] text-ink-2">not sealed yet</span>

  const onCopy = async () => {
    try {
      await copyText(value)
      toast('Copied')
    } catch {
      toast('Copy failed — select the text instead', 'bad')
    }
  }

  const btn = `flex h-11 rounded-sm w-11 items-center justify-center transition-colors ${
    onVault ? 'text-vault-ink-2 hover:bg-vault-2 hover:text-ice' : 'text-ink-2 hover:bg-paper-2 hover:text-blue'
  }`

  return (
    <span className="-my-2.5 -mr-2.5 inline-flex items-center">
      <code className={`tnum mr-1 font-mono text-[13px] ${onVault ? 'text-vault-ink' : 'text-ink'}`} title={value}>
        {shortHex(value)}
      </code>
      <button type="button" onClick={onCopy} className={btn} aria-label={`Copy ${label}`}>
        <IconCopy size={15} />
      </button>
      {kind !== 'none' ? (
        <a
          href={explorerLink(kind, value)}
          target="_blank"
          rel="noreferrer"
          className={btn}
          aria-label={`Open ${label} on Etherscan (new tab)`}
        >
          <IconArrowUpRight size={15} />
        </a>
      ) : null}
    </span>
  )
}
