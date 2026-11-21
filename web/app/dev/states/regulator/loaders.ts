// Gallery-only loaders (mock data). The app screens never import these.
import type { WatchView } from '@/lib/data'
import { encodeOpening, proofPath } from '@/lib/format'
import { mockAllReceipts, mockBreachDetail, mockBreachList, mockVerify, mockWatchView, type GalleryScenario, type VerifyDemo } from '@/lib/mock'

// Fixed clock so the sample receipt is stable between loads.
export const SAMPLE = mockAllReceipts(Date.UTC(2026, 10, 21, 7, 3), 'K7M2QD')[1]
export const PROOF = proofPath(SAMPLE)
export const [PROOF_PATH, PROOF_HASH] = PROOF.split('#')
export const BROKEN = `${PROOF_PATH}#${encodeOpening(SAMPLE).slice(0, 40)}`

export const list = (s: GalleryScenario) => () => mockBreachList(s)
export const detail = (s: GalleryScenario) => (id: string) => mockBreachDetail(id, s)
export const watch = (s: GalleryScenario) => () => mockWatchView(s)
// Retrying a NOT FOUND answers MATCH, to show "Try another node" working.
export const verify = (demo: VerifyDemo) => (opening: Parameters<typeof mockVerify>[0], _node: string, attempt: number) =>
  mockVerify(opening, attempt > 1 && demo === 'notfound' ? 'match' : demo)

/**
 * The Watch climax on demand: R.0412 answers MATCH for the first `afterMs` of this loader's life, then
 * flips to ALTERED with `changedAt` = the flip moment. So every (re)mount replays the flip live: the
 * row flashes and rises, the ALTERED counter rolls, What changed morphs and stamps.
 */
export function replayWatch(afterMs = 4500): () => Promise<WatchView> {
  const flipAt = Date.now() + afterMs
  return async () => {
    const v = await mockWatchView('live')
    const flipped = Date.now() >= flipAt
    return {
      ...v,
      rows: v.rows.map((r) =>
        r.ref !== 'R.0412'
          ? r
          : flipped
            ? { ...r, status: 'ALTERED' as const, field: 'eventType', dbValue: 'READ', chainValue: 'SHARE_THIRD_PARTY', changedAt: flipAt }
            : { ref: r.ref, eventId: r.eventId, txHash: r.txHash, logIndex: r.logIndex, controllerName: r.controllerName, status: 'MATCH' as const, blockNumber: r.blockNumber ?? 7_123_120 },
      ),
    }
  }
}
