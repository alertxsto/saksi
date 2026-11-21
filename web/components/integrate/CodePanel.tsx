import type { ReactNode } from 'react'
import { CopyButton } from './CopyButton'

type Lang = 'ts' | 'sh' | 'json' | 'out'

// One pass, left to right: comments, strings, numbers, keywords, shell flags. Enough for a light highlight;
// anything unmatched stays plain text.
const TOKEN =
  /(\/\/[^\n]*)|('(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`)|(\b\d[\d_]*\b)|\b(import|from|const|await|async|function|export|return|if|while|try|catch|throw|type|new|as|readonly)\b|((?:^|\s)-{1,2}[A-Za-z][\w-]*)/g
const CLASS = ['', 'ig-c', 'ig-s', 'ig-n', 'ig-k', 'ig-f']

function highlight(code: string, lang: Lang): ReactNode[] {
  if (lang === 'out') return [code]
  const out: ReactNode[] = []
  let last = 0
  for (const m of code.matchAll(TOKEN)) {
    const group = m.slice(1).findIndex((g) => g !== undefined) + 1
    // JSON keys read better plain; only values get the string colour.
    if (lang === 'json' && group === 2 && code[m.index + m[0].length] === ':') continue
    if (lang === 'sh' && group === 1) continue // "https://…" is not a comment
    if (lang !== 'ts' && group === 4) continue
    if (lang !== 'sh' && group === 5) continue
    if (m.index > last) out.push(code.slice(last, m.index))
    out.push(
      <span key={m.index} className={CLASS[group]}>
        {m[0]}
      </span>,
    )
    last = m.index + m[0].length
  }
  out.push(code.slice(last))
  return out
}

/**
 * Developer-docs code panel in vault colours: a header row (file name, language, copy) over a scrollable
 * block. Highlighting runs on the server; only the copy button ships JS.
 */
export function CodePanel({
  title,
  lang,
  code,
  caption,
  className = '',
}: {
  title: string
  lang: Lang
  code: string
  caption?: ReactNode
  className?: string
}) {
  const langLabel = { ts: 'TypeScript', sh: 'Shell', json: 'JSON', out: 'Output' }[lang]
  return (
    <figure className={`min-w-0 ${className}`}>
      <div className="vault overflow-hidden rounded-lg bg-vault text-vault-ink">
        <div className="flex items-center justify-between gap-3 border-b border-vault-line px-4 py-1.5">
          <p className="flex min-w-0 items-center gap-2.5 font-mono text-[12px]">
            <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-ice" />
            <span className="truncate text-vault-ink">{title}</span>
            <span className="text-vault-ink-2">{langLabel}</span>
          </p>
          <CopyButton text={code} label={title} />
        </div>
        <pre className="ig-code overflow-x-auto px-4 py-4 font-mono text-[12.5px] leading-[1.7] text-vault-ink md:text-[13px]" tabIndex={0}>
          <code>{highlight(code, lang)}</code>
        </pre>
      </div>
      {caption ? <figcaption className="mt-3 text-[13px] leading-[1.5] text-ink-2">{caption}</figcaption> : null}
    </figure>
  )
}
