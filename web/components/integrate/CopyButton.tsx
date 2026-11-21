'use client'

import { useEffect, useState } from 'react'
import { copyText } from '@/lib/data'
import { IconCheck, IconCopy } from '@/components/ui/icons'

type State = 'idle' | 'copied' | 'failed'
const LABEL: Record<State, string> = { idle: 'Copy', copied: 'Copied', failed: 'Select to copy' }

/** Copy a code block. The label answers in place (polite live region), then resets after 2 s. */
export function CopyButton({ text, label }: { text: string; label: string }) {
  const [state, setState] = useState<State>('idle')

  useEffect(() => {
    if (state === 'idle') return
    const t = setTimeout(() => setState('idle'), 2000)
    return () => clearTimeout(t)
  }, [state])

  const onCopy = async () => {
    try {
      await copyText(text)
      setState('copied')
    } catch {
      setState('failed')
    }
  }

  return (
    <button
      type="button"
      onClick={onCopy}
      aria-label={`Copy ${label}`}
      className="-mr-2 inline-flex min-h-9 items-center gap-1.5 rounded-sm px-2 font-mono text-[12px] tracking-[0.02em] text-vault-ink-2 transition-colors duration-150 hover:bg-vault-2 hover:text-vault-ink"
    >
      {state === 'copied' ? <IconCheck size={14} className="text-ok-v" /> : <IconCopy size={14} />}
      <span aria-live="polite">{LABEL[state]}</span>
    </button>
  )
}
