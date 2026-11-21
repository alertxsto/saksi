'use client'

import { useQuery } from '@tanstack/react-query'
import { AgencyPageHead, AgencyWalletPanel } from '@/components/controller/AgencyKit'
import { getControllerRecent } from '@/lib/data'
import { RecentReceipts } from '../RecentReceipts'
import { SimulationNote } from '../RecordAccess'
import { useControllerWallet } from '../wallet'

/**
 * /controller/log: the agency's last ten records. Reads the same query key as /controller, so a seal there
 * refreshes this list.
 */
export function AccessLog() {
  const { wallet, onConnect, onSwitchNetwork, onRefresh, onCopy } = useControllerWallet()
  const ready = wallet.state === 'ready' && !wallet.isChecking
  const controllerId = wallet.controller?.id
  const recent = useQuery({
    queryKey: ['controller', 'recent', controllerId],
    queryFn: () => getControllerRecent(controllerId ?? '0x'),
    enabled: ready && Boolean(controllerId),
    retry: false,
  })
  const status = !ready ? 'locked' : recent.isPending ? 'loading' : recent.isError ? 'error' : 'ready'
  return (
    <div>
      <AgencyPageHead title="Access log" description="Every lookup this agency recorded, newest first. Each one is a receipt on the citizen’s phone." />
      <SimulationNote />
      {ready ? (
        <RecentReceipts status={status} rows={recent.data ?? []} error={recent.error?.message} onRetry={() => void recent.refetch()} />
      ) : (
        <AgencyWalletPanel wallet={wallet} onConnect={onConnect} onSwitchNetwork={onSwitchNetwork} onRefresh={onRefresh} onCopy={onCopy} />
      )}
    </div>
  )
}
