import type { ReactNode } from 'react'
import { CopyButton } from './CopyButton'
import './integrate.css'

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
 * Developer-docs code panel, calm: a paper-2 sheet with a header row (file name, language, copy) over a
 * scrollable block in Geist Mono 13. Highlighting runs on the server; only the copy button ships JS.
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
      <div className="ig-panel">
        <div className="ig-panel-head flex items-center justify-between gap-3 py-1.5 pl-4 pr-3">
          <p className="flex min-w-0 items-baseline gap-2.5 text-[13px]">
            <span className="truncate font-medium text-ink">{title}</span>
            <span className="shrink-0 text-ink-3">{langLabel}</span>
          </p>
          <CopyButton text={code} label={title} />
        </div>
        <pre className="ig-code overflow-x-auto px-4 py-4 font-mono text-[13px] leading-[1.7]" tabIndex={0}>
          <code>{highlight(code, lang)}</code>
        </pre>
      </div>
      {caption ? <figcaption className="mt-3 text-[13px] leading-[1.5] text-ink-2">{caption}</figcaption> : null}
    </figure>
  )
}
