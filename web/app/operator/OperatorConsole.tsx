'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { AgencyPageHead } from '@/components/controller/AgencyKit'
import { IconLock } from '@/components/controller/agency-icons'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import {
  ApiClientError,
  getDemoReceipts,
  getServiceStatus,
  getWatchSummary,
  tamperReceipt,
  watchKey,
  type TamperAction,
  type TamperReport,
} from '@/lib/data'
import { OperatorRoomView, refOf, RoomSteps, TokenGateView, type RoomData } from './OperatorRoom'

const WATCH_MS = 3000
const RECEIPTS_MS = 10_000
// The status probe runs a tiny AI completion, so it refreshes slowly and on demand.
const STATUS_MS = 60_000

// ---- token: sessionStorage only (never URL, cookies or logs) -------------------------------------
const TOKEN_KEY = 'saksi.operator.token'
const tokenListeners = new Set<() => void>()
// In-memory copy for browsers where sessionStorage throws (private windows, blocked site data).
let memoryToken = ''

function readToken(): string {
  try {
    return sessionStorage.getItem(TOKEN_KEY) ?? memoryToken
  } catch {
    return memoryToken
  }
}

function writeToken(value: string | null) {
  memoryToken = value ?? ''
  try {
    if (value) sessionStorage.setItem(TOKEN_KEY, value)
    else sessionStorage.removeItem(TOKEN_KEY)
  } catch {
    /* Storage unavailable: the in-memory copy lasts until the tab reloads. */
  }
  tokenListeners.forEach((listener) => listener())
}

function subscribeToken(listener: () => void) {
  tokenListeners.add(listener)
  return () => tokenListeners.delete(listener)
}

const useToken = () => useSyncExternalStore(subscribeToken, readToken, () => '')
const rejected = (error: unknown) => error instanceof ApiClientError && error.status === 403
const messageOf = (error: unknown) => (error instanceof Error ? error.message : 'Something went wrong.')

const DONE: Record<TamperAction, string> = {
  edit: 'edited: the database now says a different action',
  delete: 'deleted from the database',
  restore: 'restored to its recorded state',
}

// ---- token gate ---------------------------------------------------------------------------------

function TokenGate() {
  const { toast } = useToast()
  // Same check as before: the token is accepted only if the receipts endpoint takes it.
  const onUnlock = async (candidate: string): Promise<string | null> => {
    try {
      await getDemoReceipts(candidate)
      writeToken(candidate)
      toast('Console unlocked for this tab')
      return null
    } catch (err) {
      return rejected(err) ? 'That token was rejected. Check the admin token on the server.' : messageOf(err)
    }
  }
  return <TokenGateView onUnlock={onUnlock} />
}

// ---- console ------------------------------------------------------------------------------------

function Console({ token }: { token: string }) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [busy, setBusy] = useState<{ id: string; action: TamperAction } | null>(null)
  const [report, setReport] = useState<TamperReport | null>(null)

  const receipts = useQuery({
    queryKey: ['operator', 'receipts'],
    queryFn: () => getDemoReceipts(token),
    refetchInterval: RECEIPTS_MS,
    retry: false,
  })
  const watch = useQuery({
    queryKey: ['operator', 'watch'],
    queryFn: getWatchSummary,
    refetchInterval: WATCH_MS,
    refetchIntervalInBackground: false,
    retry: false,
  })
  const status = useQuery({
    queryKey: ['operator', 'status'],
    queryFn: () => getServiceStatus(token),
    refetchInterval: STATUS_MS,
    retry: false,
  })

  // A rotated or wrong token: forget it and go back to the gate.
  const lostToken = rejected(receipts.error) || rejected(status.error)
  useEffect(() => {
    if (!lostToken) return
    writeToken(null)
    queryClient.removeQueries({ queryKey: ['operator'] })
    toast('The admin token was rejected. Paste it again.', 'bad')
  }, [lostToken, queryClient, toast])

  const tamper = useMutation({
    mutationFn: ({ id, action }: { id: string; action: TamperAction }) => tamperReceipt(token, action, id),
    onMutate: (vars) => setBusy(vars),
    onSuccess: (result, { id, action }) => {
      setReport(result)
      toast(`${refOf(id)} ${DONE[action]}`)
    },
    onError: (error) => {
      if (rejected(error)) writeToken(null)
      toast(messageOf(error), 'bad')
    },
    onSettled: async () => {
      setBusy(null)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['operator', 'receipts'] }),
        queryClient.invalidateQueries({ queryKey: ['operator', 'watch'] }),
      ])
    },
  })

  const data: RoomData = {
    rows: receipts.data ?? [],
    rowsState: receipts.isPending ? 'loading' : receipts.isError && !receipts.data ? 'error' : 'ready',
    rowsError: receipts.error ? messageOf(receipts.error) : undefined,
    refreshing: receipts.isFetching && !receipts.isPending,
    watch: watch.data,
    watchError: watch.isError,
    status: status.data,
    statusPending: status.isPending,
    statusFetching: status.isFetching && !status.isPending,
    statusError: status.error ? messageOf(status.error) : null,
    report,
    busy,
  }

  return (
    <OperatorRoomView
      data={data}
      verdictOf={(row) => watch.data?.verdicts.get(watchKey(row.txHash, row.logIndex))}
      onAction={(id, action) => tamper.mutate({ id, action })}
      onRefresh={() => void receipts.refetch()}
      onRecheck={() => void status.refetch()}
    />
  )
}

/** Presenter console for the live demo: tamper a sealed receipt in the database and watch Saksi catch it. */
export function OperatorConsole() {
  const token = useToken()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const lock = () => {
    writeToken(null)
    queryClient.removeQueries({ queryKey: ['operator'] })
    toast('Console locked', 'info')
  }
  return (
    <div className="flex flex-col gap-6">
      <AgencyPageHead
        title="Evidence room"
        description="Change a sealed record in the agency’s database, the way a careless or dishonest insider could. The citizen’s phone checks it against the public ledger and turns red."
        action={
          token ? (
            <Button variant="light" size="sm" icon={<IconLock size={15} />} onClick={lock}>
              Lock the room
            </Button>
          ) : null
        }
      />
      <RoomSteps />
      {token ? <Console token={token} /> : <TokenGate />}
    </div>
  )
}
