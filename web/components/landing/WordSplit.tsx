'use client'

import type { CSSProperties } from 'react'
import { useT } from '@/lib/client/lang'

/**
 * Word spans with a running index (--i) for the word-rise animation. Client-side so the EN / ID switch can
 * translate the whole sentence before it is split: translating word by word would scramble the grammar.
 */
export function WordSplit({ text, from = 0, className = 'w' }: { text: string; from?: number; className?: string }) {
  const t = useT()(text)
  return (
    <>
      {t.split(' ').flatMap((w, k) => [
        k ? ' ' : null,
        <span key={k} className={className} style={{ '--i': from + k } as CSSProperties}>
          {w}
        </span>,
      ])}
    </>
  )
}
