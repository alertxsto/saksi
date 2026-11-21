'use client'

import { useEffect, useState } from 'react'
import type { AutoVerdicts, GhostReceipt } from '@/lib/data'
import type { ReceiptOpening } from '@/lib/shared/types'

// The phone remembers every sealed receipt it was shown, per profile code, so a receipt the company later
// deletes from its database still shows up as DELETED. Only copies this browser has checked against the
// chain (MATCH) are remembered, so an edited row never replaces the sealed version and /proof can re-verify it.
const KEY = 'saksi:seen-receipts:v1'
type Store = { code: string; seen: Record<string, GhostReceipt> }

function read(): Store | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Store) : null
  } catch {
    return null
  }
}

function write(store: Store) {
  try {
    localStorage.setItem(KEY, JSON.stringify(store))
  } catch {
    // Private mode or full storage: the list still works, it just can't remember deleted receipts.
  }
}

const sameIds = (a: GhostReceipt[], b: GhostReceipt[]) =>
  a.length === b.length && a.every((g, i) => g.opening.eventId === b[i].opening.eventId)

/**
 * Sealed receipts this phone saw earlier that GET /api/citizen/receipts no longer returns, newest first.
 * `loaded` must be true only for a successful response, so a failed request never turns rows into ghosts.
 */
export function useGhostReceipts(code: string, receipts: ReceiptOpening[], verdicts: AutoVerdicts, loaded: boolean): GhostReceipt[] {
  const matched = receipts.filter((r) => verdicts[r.eventId] === 'match').map((r) => r.eventId).join()
  const [ghosts, setGhosts] = useState<GhostReceipt[]>([])
  useEffect(() => {
    if (!loaded || !code) return
    const prev = read()
    const seen = prev?.code === code ? prev.seen : {}
    const now = Date.now()
    const present = new Set(receipts.map((r) => r.eventId))
    for (const r of receipts) {
      if (verdicts[r.eventId] === 'match') seen[r.eventId] = { opening: r, lastSeenAt: now }
      else if (seen[r.eventId]) seen[r.eventId] = { ...seen[r.eventId], lastSeenAt: now }
    }
    write({ code, seen })
    const missing = Object.values(seen)
      .filter((g) => !present.has(g.opening.eventId))
      .sort((a, b) => b.lastSeenAt - a.lastSeenAt)
    setGhosts((cur) => (sameIds(cur, missing) ? cur : missing))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `matched` stands in for `verdicts`, a new object every render
  }, [code, receipts, matched, loaded])
  return ghosts
}
