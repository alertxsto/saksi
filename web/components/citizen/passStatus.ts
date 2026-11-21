import type { PassVerdict } from './CitizenPass'

/** Counts the list already derives from the receipts, the auto-verify verdicts and the ghosts. */
export type PassCounts = {
  state: 'loading' | 'error' | 'empty' | 'ready'
  total: number
  matched: number
  checking: number
  anchored: number
  sealing: number
  /** Altered + deleted (ghosts and hidden receipts). Above 0 is the only way the pass turns red. */
  tampered: number
  watching: boolean
}

/** Two-line version for the compact pass in the laptop sidebar (about 24 characters a line). */
export function passShortTitle(c: PassCounts): string {
  if (c.tampered > 0) return 'Tampering found'
  if (c.state === 'loading') return 'Loading receipts'
  if (c.state === 'error') return 'Receipts didn’t load'
  if (c.state === 'empty' || c.total === 0) return 'No receipts yet'
  if (c.checking > 0) return `Checking ${c.checking} ${c.checking === 1 ? 'receipt' : 'receipts'}`
  if (c.matched > 0) return c.matched === c.total ? `All ${c.total} match the sealed record` : `${c.matched} of ${c.total} match the seal`
  if (c.sealing > 0) return `${c.sealing} being sealed`
  return `${c.total} on record`
}

/** What Saksi does for you, in one line (riset-ui/37 §1): shown under the verdict on the pass. */
const WITNESS = 'Saksi witnesses every access to your data.'

/**
 * The one sentence on the Citizen Pass, in witness voice (riset-ui/37 §2): "matches the sealed record",
 * "changed after sealing". Freshness is "checked just now", never a ticker.
 */
export function passStatus(c: PassCounts): { verdict: PassVerdict; title: string; subtitle: string } {
  const paused = c.watching ? '' : ' Paused while offline.'
  if (c.tampered > 0)
    return {
      verdict: 'tamper',
      title: `${c.tampered} ${c.tampered === 1 ? 'record was' : 'records were'} changed after sealing`,
      subtitle: 'Your phone caught it against the sealed record, not Saksi’s server.',
    }
  if (c.state === 'loading') return { verdict: 'checking', title: 'Loading your receipts', subtitle: WITNESS }
  if (c.state === 'error') return { verdict: 'empty', title: 'Receipts didn’t load', subtitle: 'Every seal is still safe on the public ledger.' }
  if (c.state === 'empty' || c.total === 0)
    return { verdict: 'empty', title: 'No agency has opened your data yet', subtitle: `${WITNESS} Receipts arrive here within seconds.${paused}` }
  if (c.checking > 0)
    return {
      verdict: 'checking',
      title: `Your phone is checking ${c.checking} ${c.checking === 1 ? 'receipt' : 'receipts'}`,
      subtitle: `${WITNESS} Your phone compares each one with its seal.${paused}`,
    }
  if (c.matched > 0) {
    const all = c.matched === c.anchored
    const title = all
      ? c.anchored === c.total
        ? c.total === 1
          ? 'Your receipt matches the sealed record'
          : `All ${c.total} receipts match the sealed record`
        : `${c.matched} of ${c.total} receipts match the sealed record`
      : `${c.matched} of ${c.anchored} sealed receipts match the record`
    return { verdict: 'ok', title, subtitle: `${WITNESS} Your phone checked each one just now.${paused}` }
  }
  if (c.sealing > 0)
    return {
      verdict: 'empty',
      title: `${c.sealing} ${c.sealing === 1 ? 'receipt is' : 'receipts are'} being sealed`,
      subtitle: `${WITNESS} Your phone checks each one once it is sealed.${paused}`,
    }
  return { verdict: 'empty', title: `${c.total} ${c.total === 1 ? 'receipt' : 'receipts'} on record`, subtitle: `${WITNESS} Your phone checks each one once it is sealed.${paused}` }
}
