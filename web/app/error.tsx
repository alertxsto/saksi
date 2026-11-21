'use client'

import { ReconnectScreen } from '@/components/system/ReconnectScreen'

/** Any segment under the root layout failed to render (server restart, RPC dropped): calm, auto-retrying. */
export default function RouteError({ error, retry }: { error: unknown; retry: () => void }) {
  return <ReconnectScreen error={error} retry={retry} />
}
