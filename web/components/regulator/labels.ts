import { humanWatchValue } from '@/lib/data'

/** Field names as the rest of the app says them (same words as VerifyResult). Values go through humanWatchValue in lib/data. */
export const FIELD_LABEL: Record<string, string> = {
  eventType: 'What they did',
  legalBasis: 'Legal basis',
  purpose: 'Why',
  evidence: 'Evidence',
  pseudonym: 'Pseudonym',
  contract: 'Contract',
  row: 'Whole row',
  txHash: 'Chain transaction',
  status: 'Record status',
  seal: 'Seal',
  opening: 'Stored record',
}

export const fieldLabel = (field: string | null | undefined) => (field ? (FIELD_LABEL[field] ?? field) : null)

/** humanWatchValue for composite values too ("READ · Account review · Contract" → "Read · Account review · Contract"). */
export const humanValue = (v: string) => v.split(' · ').map(humanWatchValue).join(' · ')
