import type { ControllerRegisterRow } from '@/lib/data'
import type { Standing } from './Workspace'

/** Altered + deleted records found by Watch (0 when Watch could not check). */
export const tampered = (c: ControllerRegisterRow) => (c.altered ?? 0) + (c.deleted ?? 0)

/**
 * Compliance standing in plain words, worst first: revoked, tampered, not checked, late breach notice,
 * open citizen reports, good standing. Red only for tamper; late is amber.
 */
export function standingOf(c: ControllerRegisterRow, watchKnown: boolean): Standing {
  if (c.status === 'revoked') return { label: 'Revoked', tone: 'muted', note: 'Its wallet can no longer seal receipts.' }
  if (tampered(c) > 0) return { label: 'Record tampered', tone: 'bad', note: 'A sealed record was changed or deleted afterwards.' }
  if (!watchKnown || c.altered === null) return { label: 'Not checked', tone: 'muted', note: 'Watch could not reach the public ledger. This is not a sign of tampering.' }
  if (c.breachesLate > 0) return { label: 'Late breach notice', tone: 'pending', note: 'A breach notice came in after 3×24 h (UU PDP Pasal 46).' }
  if (c.openReports) return { label: 'Reports open', tone: 'neutral', note: 'Citizens reported an access. Waiting for your review.' }
  return { label: 'In good standing', tone: 'ok', note: 'Every sealed record matches and every notice was on time.' }
}
