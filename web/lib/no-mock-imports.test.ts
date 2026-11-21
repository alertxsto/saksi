import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// lib/mock.ts holds fixtures for the /dev design galleries only (app/dev/**, which 404 in production).
// Product screens must read lib/data.ts, so any other importer of lib/mock fails this test.
const web = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const mock = join(web, 'lib', 'mock')
const SKIP_DIRS = new Set(['node_modules', '.next', 'public', 'drizzle'])
const SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*)['"]([^'"]+)['"]/g

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return SKIP_DIRS.has(entry.name) ? [] : sources(path)
    return /\.(m?[jt]sx?)$/.test(entry.name) ? [path] : []
  })
}

const allowed = (file: string) => {
  const rel = relative(web, file).split(sep).join('/')
  return rel.startsWith('app/dev/') || rel.startsWith('test/') || /\.test\.[jt]sx?$/.test(rel) || rel === 'lib/mock.ts'
}

/** Resolves an import specifier to an absolute path without extension ('@/' is the web root, see tsconfig paths). */
function target(file: string, specifier: string) {
  if (specifier.startsWith('@/')) return join(web, specifier.slice(2))
  if (specifier.startsWith('.')) return resolve(dirname(file), specifier)
  return null
}

function mockImporters(files: string[]) {
  return files.filter((file) => !allowed(file)).filter((file) => {
    const text = readFileSync(file, 'utf8')
    return [...text.matchAll(SPECIFIER)].some(([, specifier]) => {
      const path = target(file, specifier)?.replace(/\.(m?[jt]sx?)$/, '')
      return path === mock
    })
  }).map((file) => relative(web, file).split(sep).join('/'))
}

describe('lib/mock is gallery-only', () => {
  it('is imported by no product file outside app/dev/** and tests', () => {
    expect(mockImporters(sources(web))).toEqual([])
  })

  it('the scan finds the gallery importers it allows, so it is really looking', () => {
    const gallery = sources(join(web, 'app', 'dev')).filter((file) =>
      [...readFileSync(file, 'utf8').matchAll(SPECIFIER)].some(([, s]) => target(file, s) === mock))
    expect(gallery.length).toBeGreaterThan(0)
  })
})
