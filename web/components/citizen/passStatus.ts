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

/** The one sentence on the Citizen Pass (riset-ui/35 home §2 status, now on the pass). */
export function passStatus(c: PassCounts): { verdict: PassVerdict; title: string; subtitle: string } {
  const live = c.watching ? '' : 'Paused · '
  if (c.tampered > 0)
    return {
      verdict: 'tamper',
      title: `${c.tampered} ${c.tampered === 1 ? 'record no longer matches' : 'records no longer match'} the chain`,
      subtitle: 'Your phone caught it, not Saksi’s server.',
    }
  if (c.state === 'loading') return { verdict: 'checking', title: 'Loading your receipts', subtitle: 'Fetching what companies logged.' }
  if (c.state === 'error') return { verdict: 'empty', title: 'Receipts didn’t load', subtitle: 'Your sealed receipts are safe on chain.' }
  if (c.state === 'empty' || c.total === 0)
    return { verdict: 'empty', title: 'No one has opened your data yet', subtitle: `${live}Receipts appear here within seconds.` }
  if (c.checking > 0)
    return {
      verdict: 'checking',
      title: `Checking ${c.checking} ${c.checking === 1 ? 'receipt' : 'receipts'} against the chain`,
      subtitle: `${live}Your phone is checking, not our server.`,
    }
  if (c.matched > 0) {
    const all = c.matched === c.anchored
    const title = all
      ? c.anchored === c.total
        ? c.total === 1
          ? 'Your receipt matches the chain'
          : `All ${c.total} receipts match the chain`
        : `${c.matched} of ${c.total} receipts match the chain`
      : `${c.matched} of ${c.anchored} sealed receipts match the chain`
    return { verdict: 'ok', title, subtitle: `${live}Checked by your phone, not by Saksi’s server.` }
  }
  if (c.sealing > 0)
    return {
      verdict: 'empty',
      title: `${c.sealing} ${c.sealing === 1 ? 'receipt is' : 'receipts are'} being sealed`,
      subtitle: `${live}Your phone checks each one once it is sealed.`,
    }
  return { verdict: 'empty', title: `${c.total} ${c.total === 1 ? 'receipt' : 'receipts'} on record`, subtitle: `${live}Your phone checks each one once it is sealed.` }
}
