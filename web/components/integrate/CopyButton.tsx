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
      className="ig-copy -mr-2 inline-flex min-h-9 items-center gap-1.5 rounded-pill px-3 text-[13px] font-medium text-ink-2"
    >
      {state === 'copied' ? <IconCheck size={14} className="text-ok" /> : <IconCopy size={14} />}
      <span aria-live="polite">{LABEL[state]}</span>
    </button>
  )
}
