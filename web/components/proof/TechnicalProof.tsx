'use client'

import { useEffect, useState } from 'react'
import { IconArrow, IconCheck, IconCopy, IconExternal } from '@/components/ui/icons'
import { copyText, explorerLink } from '@/lib/data'
import { shortHex } from '@/lib/format'
import './proof.css'

const JOURNAL = process.env.NEXT_PUBLIC_JOURNAL_ADDRESS || null

function Copy({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false)
  useEffect(() => {
    if (!done) return
    const t = setTimeout(() => setDone(false), 1600)
    return () => clearTimeout(t)
  }, [done])
  return (
    <button
      type="button"
      onClick={() => void copyText(text).then(() => setDone(true), () => undefined)}
      aria-label={`Copy ${label}`}
      className="flex size-9 shrink-0 items-center justify-center rounded-sm text-ink-3 transition-colors duration-150 hover:bg-paper-2 hover:text-ink"
    >
      {done ? <IconCheck size={14} strokeWidth={2.4} className="text-ok" /> : <IconCopy size={14} />}
      <span className="sr-only" aria-live="polite">
        {done ? 'Copied' : ''}
      </span>
    </button>
  )
}

function Explorer({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={`${label} on the block explorer`}
      className="flex size-9 shrink-0 items-center justify-center rounded-sm text-ink-3 transition-colors duration-150 hover:bg-paper-2 hover:text-blue"
    >
      <IconExternal size={14} />
    </a>
  )
}

type Line = { k: string; v: string; full?: string; copy?: string; href?: string }

/**
 * Chain data lives here and only here (riset-ui/37 §2): a disclosure that starts collapsed, with the
 * transaction, block, contract, log index and node, each copyable and linked to the explorer, plus the raw
 * fields this browser compared.
 */
export function TechnicalProof({
  txHash,
  logIndex,
  blockNumber,
  confirmations,
  node,
  raw,
}: {
  txHash: string | null
  logIndex: number | null
  blockNumber?: number
  confirmations?: number
  node: string
  /** The fields this browser compared (shown as JSON). */
  raw?: Record<string, unknown>
}) {
  const lines: Line[] = [
    txHash
      ? { k: 'Transaction', v: shortHex(txHash, 10, 8), full: txHash, copy: txHash, href: explorerLink('tx', txHash) }
      : { k: 'Transaction', v: 'Not sealed yet' },
    { k: 'Log index', v: logIndex !== null && logIndex !== undefined ? String(logIndex) : '—' },
    { k: 'Block', v: blockNumber ? Number(blockNumber).toLocaleString('en-US') : '—' },
    { k: 'Confirmations', v: confirmations !== undefined ? confirmations.toLocaleString('en-US') : '—' },
    JOURNAL
      ? { k: 'Contract', v: shortHex(JOURNAL, 10, 8), full: JOURNAL, copy: JOURNAL, href: explorerLink('address', JOURNAL) }
      : { k: 'Contract', v: '—' },
    { k: 'Node', v: node },
  ]
  return (
    <details className="pf-details group rounded-lg border border-line bg-card">
      <summary className="flex min-h-14 cursor-pointer items-center justify-between gap-3 rounded-lg px-4 text-[15px] font-semibold text-ink transition-colors duration-150 hover:text-blue focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue">
        <span className="flex flex-col">
          Technical proof
          <span className="text-[13px] font-normal text-ink-3">Transaction, block, contract and node</span>
        </span>
        <IconArrow size={14} className="pf-chev rotate-90 text-ink-3" aria-hidden="true" />
      </summary>
      <div className="border-t border-line px-4 pb-3 pt-1">
        <dl>
          {lines.map((l) => (
            <div key={l.k} className="flex min-h-11 items-center gap-2 border-b border-line/70 last:border-b-0">
              <dt className="w-[108px] shrink-0 text-[13px] text-ink-2">{l.k}</dt>
              <dd className="tnum min-w-0 flex-1 truncate font-mono text-[13px] text-ink" title={l.full ?? l.v}>
                {l.v}
              </dd>
              {l.copy ? <Copy text={l.copy} label={l.k.toLowerCase()} /> : null}
              {l.href ? <Explorer href={l.href} label={l.k} /> : null}
            </div>
          ))}
        </dl>
        {raw ? (
          <details className="pf-details mt-2">
            <summary className="flex min-h-10 cursor-pointer items-center gap-2 text-[13px] font-medium text-ink-2 hover:text-ink">
              <IconArrow size={12} className="pf-chev rotate-90" aria-hidden="true" /> Raw fields this browser compared
            </summary>
            <pre className="mt-1 max-h-64 overflow-auto rounded-md bg-paper-2 p-3 font-mono text-[12px] leading-relaxed text-ink">{JSON.stringify(raw, null, 2)}</pre>
          </details>
        ) : null}
        <p className="mt-2 text-[12px] leading-relaxed text-ink-3">
          The receipt details travel in the link after “#”. Browsers never send that part to any server.
        </p>
      </div>
    </details>
  )
}
