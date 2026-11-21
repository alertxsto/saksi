import { Cta } from '@/components/landing/Cta'
import { RequestedRef } from './RequestedRef'
import { NothingSealedArt } from './SystemArt'
import { SystemMeta, SystemScreen } from './SystemScreen'

export type NotFoundKind = 'page' | 'receipt' | 'proof'

const COPY: Record<NotFoundKind, { tail: string; body: string }> = {
  page: {
    tail: 'This link doesn’t lead anywhere.',
    body: 'The link may be mistyped or cut short. Anything that was really sealed is still on the public chain, and your receipts are where you left them.',
  },
  receipt: {
    tail: 'This receipt isn’t in your profile.',
    body: 'It may belong to a deleted profile, or the link was copied only in part. Your other receipts are still in your list.',
  },
  proof: {
    tail: 'No sealed record at this transaction.',
    body: 'Check that the link was copied in full, including the log index at the end. You can also paste the receipt into the verifier and check it again.',
  },
}

const ACTIONS: Record<NotFoundKind, [primary: [string, string], secondary: [string, string]]> = {
  page: [
    ['/', 'Go home'],
    ['/citizen', 'Back to receipts'],
  ],
  receipt: [
    ['/citizen', 'Back to receipts'],
    ['/', 'Go home'],
  ],
  proof: [
    ['/proof', 'Open the verifier'],
    ['/', 'Go home'],
  ],
}

/** "Nothing sealed here." for a wrong URL, a missing receipt id, or a missing proof. Landing Cta pair: dark + light. */
export function NotFoundScreen({
  kind = 'page',
  chrome,
  stack,
  requested,
}: {
  kind?: NotFoundKind
  chrome?: 'page' | 'embedded'
  stack?: boolean
  /** Shown instead of the live route params (gallery frames have none). */
  requested?: string
}) {
  const { tail, body } = COPY[kind]
  const [primary, secondary] = ACTIONS[kind]
  const full = stack ? 'w-full' : 'max-sm:w-full'
  const label = kind === 'receipt' ? 'Receipt' : 'Looked for'
  const meta = requested ? (
    <SystemMeta label={label}>{requested}</SystemMeta>
  ) : kind === 'receipt' ? (
    <RequestedRef label={label} params={['eventId']} />
  ) : kind === 'proof' ? (
    <RequestedRef label={label} params={['tx', 'logIndex']} />
  ) : undefined

  return (
    <SystemScreen
      chrome={chrome}
      stack={stack}
      art={<NothingSealedArt />}
      title="Nothing sealed here."
      tail={tail}
      body={body}
      meta={meta}
      actions={
        <>
          <Cta href={primary[0]} className={`${full} justify-between`}>
            {primary[1]}
          </Cta>
          <Cta href={secondary[0]} variant="light" className={`${full} justify-center`}>
            {secondary[1]}
          </Cta>
        </>
      }
    />
  )
}
