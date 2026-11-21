// Pure helpers for the citizen profile: "who has opened your data" is counted from the profile's own
// receipts (GET /api/citizen/receipts), and the verdict counts come from this browser's chain checks.
import type { AutoVerdicts } from '@/lib/data'
import type { ReceiptOpening } from '@/lib/shared/types'

export type ControllerAccess = {
  controllerId: string
  name: string
  count: number
  /** ISO time of the most recent access. */
  lastAt: string
  /** Event type of the most recent access (picks the glyph). */
  lastType: number
  /** Accesses per event type: [READ, UPDATE, EXPORT, SHARED]. */
  kinds: [number, number, number, number]
  /** Receipts this phone found unchanged on chain. */
  match: number
  /** Receipts this phone proved edited after sealing. */
  altered: number
  /** Everything not yet decided by the phone (checking, not sealed yet, not on this node). */
  open: number
}

export type AccessTotals = { receipts: number; controllers: number; verified: number; altered: number }

const clean = (name: string) => name.replace(' (fictional)', '')

/** One row per controller, most recent first. */
export function aggregateAccess(receipts: readonly ReceiptOpening[], verdicts: AutoVerdicts = {}): ControllerAccess[] {
  const by = new Map<string, ControllerAccess>()
  for (const r of receipts) {
    let row = by.get(r.controllerId)
    if (!row) {
      row = { controllerId: r.controllerId, name: clean(r.controllerName), count: 0, lastAt: r.createdAt, lastType: r.eventType, kinds: [0, 0, 0, 0], match: 0, altered: 0, open: 0 }
      by.set(r.controllerId, row)
    }
    row.count += 1
    if (r.eventType >= 0 && r.eventType <= 3) row.kinds[r.eventType] += 1
    if (new Date(r.createdAt).getTime() > new Date(row.lastAt).getTime()) {
      row.lastAt = r.createdAt
      row.lastType = r.eventType
    }
    const v = verdicts[r.eventId]
    if (v === 'match') row.match += 1
    else if (v === 'altered') row.altered += 1
    else row.open += 1
  }
  return [...by.values()].sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime())
}

export function accessTotals(rows: readonly ControllerAccess[]): AccessTotals {
  return rows.reduce<AccessTotals>(
    (t, r) => ({ receipts: t.receipts + r.count, controllers: t.controllers + 1, verified: t.verified + r.match, altered: t.altered + r.altered }),
    { receipts: 0, controllers: 0, verified: 0, altered: 0 },
  )
}

/** The JSON file "Download all receipts" saves: the receipts exactly as this profile loaded them. */
export function receiptsExport(code: string, receipts: readonly ReceiptOpening[], exportedAt: Date) {
  return {
    format: 'saksi-receipts',
    version: 1,
    exportedAt: exportedAt.toISOString(),
    profileCode: code,
    note: 'Synthetic profile. Each receipt can be re-checked against the public chain at /proof.',
    count: receipts.length,
    receipts,
  }
}

/** Saves receiptsExport() as saksi-receipts-<code>-<yyyy-mm-dd>.json in the browser. */
export function downloadReceiptsJson(code: string, receipts: readonly ReceiptOpening[]) {
  const now = new Date()
  const blob = new Blob([JSON.stringify(receiptsExport(code, receipts, now), null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `saksi-receipts-${code}-${now.toISOString().slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
