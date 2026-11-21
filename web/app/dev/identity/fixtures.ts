// Fixed-clock fixtures for the three identity directions (/dev/identity/a|b|c). Same synthetic data as the
// citizen gallery, so each direction is judged on styling alone. Nothing here reaches production screens.
import { basisLabel, eventVerb, formatWIB, shortHex, timeAgo, timeBucket } from '@/lib/format'
import { MOCK_BLOCK_BASE, mockAllReceipts, mockWorkspaceReceipts } from '@/lib/mock'
import type { ReceiptOpening } from '@/lib/shared/types'

export const NOW = Date.UTC(2026, 10, 21, 7, 3)
export const CODE = 'K7M2QD'
const ALL = mockAllReceipts(NOW, CODE)

/** Home: one receipt still being sealed (amber), four sealed and matched by the phone. */
export const HOME: ReceiptOpening[] = [
  { ...ALL[0], createdAt: new Date(NOW - 3 * 60_000).toISOString(), status: 'submitted', txHash: null, logIndex: null },
  ALL[1],
  ALL[2],
  ALL[3],
  ALL[4],
]
/** Detail + workspace pane: Contoh Lending shared the data with a third party (debt collection). */
export const OPENING = ALL[1]
export const WS = mockWorkspaceReceipts(NOW, CODE)

export const MATCH = {
  blockNumber: MOCK_BLOCK_BASE - 214,
  confirmations: 214,
  elapsedMs: 1840,
  rpc: 'publicnode.com',
}

export const who = (o: Pick<ReceiptOpening, 'controllerName'>) => o.controllerName.replace(' (fictional)', '')
export const sentence = (s: string) => s.charAt(0) + s.slice(1).toLowerCase()
export const ago = (o: ReceiptOpening) => timeAgo(o.createdAt, NOW)
export const sealing = (o: ReceiptOpening) => o.status === 'pending' || o.status === 'submitted'

/** "13:16" in WIB. */
export function clock(o: ReceiptOpening): string {
  return new Date(o.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jakarta' })
}
/** "21 Nov" in WIB. */
export function day(o: ReceiptOpening): string {
  return new Date(o.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'Asia/Jakarta' })
}

/** Short verb for big type: Read / Updated / Exported / Shared. */
export const VERB = ['Read', 'Updated', 'Exported', 'Shared'] as const
export const VERB_TAIL = ['your data', 'your data', 'your data', 'with a third party'] as const

const LABEL = { NOW: 'Just now', TODAY: 'Today', EARLIER: 'Earlier' } as const
export function buckets(receipts: ReceiptOpening[]) {
  return (['NOW', 'TODAY', 'EARLIER'] as const)
    .map((b) => ({ key: b, label: LABEL[b], items: receipts.filter((r) => timeBucket(r.createdAt, NOW) === b) }))
    .filter((g) => g.items.length > 0)
}

/** Register serial derived from the event id: evt_7Q2M4K → R-7Q2M. */
export const serial = (o: ReceiptOpening) => `R-${o.eventId.replace(/^evt_/i, '').slice(0, 4).toUpperCase()}`

export function facts(o: ReceiptOpening) {
  const ev = o.evidence as { system?: string; dataCategories?: string[] }
  return {
    action: sentence(eventVerb(o.eventType)),
    purpose: o.purposeText,
    basis: basisLabel(o.legalBasisKey),
    data: [ev.system, (ev.dataCategories ?? []).join(', ')].filter(Boolean).join(' · '),
    sealed: formatWIB(o.createdAt),
    block: MATCH.blockNumber.toLocaleString('en-US'),
    fingerprint: shortHex(o.txHash, 8, 6),
  }
}
