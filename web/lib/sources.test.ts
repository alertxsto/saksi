import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { formatSourceDate, SOURCES, sourceHref, sourceNumber } from './sources'

const WEB = fileURLToPath(new URL('..', import.meta.url))

/** Every .tsx under app/ and components/, as [relative path, source]. */
function uiFiles(): [string, string][] {
  return ['app', 'components'].flatMap((dir) =>
    (readdirSync(join(WEB, dir), { recursive: true }) as string[])
      .filter((f) => f.endsWith('.tsx'))
      .map((f): [string, string] => [`${dir}/${f}`, readFileSync(join(WEB, dir, f), 'utf8')]),
  )
}

/** Source ids named in `<Cite ids={[...]}` and in `cite: [...]` data arrays. */
function citedIds(src: string): string[] {
  const lists = [...src.matchAll(/(?:\bids=\{\[|\bcite:\s*\[)([^\]]*)\]/g)].map((m) => m[1])
  return lists.flatMap((l) => [...l.matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1]))
}

describe('sources', () => {
  it('every source has a unique id, an https url and the required fields', () => {
    const ids = SOURCES.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const s of SOURCES) {
      expect(new URL(s.url).protocol, s.id).toBe('https:')
      for (const k of ['claim', 'figure', 'title', 'publisher', 'quote'] as const) expect(s[k].trim(), `${s.id}.${k}`).not.toBe('')
      expect(s.date, s.id).toMatch(/^\d{4}(-\d{2}(-\d{2})?)?$/)
    }
  })

  it('every citation id used in the UI exists in sources.ts', () => {
    const known = new Set<string>(SOURCES.map((s) => s.id))
    const used = uiFiles().flatMap(([file, src]) => citedIds(src).map((id) => ({ file, id })))
    // the landing (BreachClock, ProblemMoment, Faq) and /why all cite; an empty scan means the regex broke
    expect(new Set(used.map((u) => u.file)).size).toBeGreaterThanOrEqual(4)
    expect(used.filter((u) => !known.has(u.id))).toEqual([])
  })

  it('numbers citations by position and links to the matching /why anchor', () => {
    expect(sourceNumber(SOURCES[0].id)).toBe(1)
    expect(sourceHref(SOURCES[SOURCES.length - 1].id)).toBe(`/why#source-${SOURCES.length}`)
    expect(() => sourceNumber('not-a-source' as never)).toThrow(/unknown source/)
  })

  it('formats full, month and year-only dates', () => {
    expect(formatSourceDate('2025-10-10')).toBe('10 Oct 2025')
    expect(formatSourceDate('2023-12')).toBe('Dec 2023')
    expect(formatSourceDate('2021')).toBe('2021')
  })
})
