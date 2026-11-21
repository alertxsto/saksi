'use client'

import { useEffect, useRef, useState } from 'react'
import { BaseError, ContractFunctionRevertedError, keccak256, toHex } from 'viem'
import { useToast } from '@/components/ui/Toast'
import { txViewFromState } from '@/components/ui/TxStepper'
import { WalletGate } from '@/components/ui/WalletGate'
import { useAnchorBreach } from '@/lib/client/controller'
import type { TransactionState } from '@/lib/client/transactions'
import { DRAFT_OUT_OF_SCOPE, draftBreachStream, type BreachNoticeInput } from '@/lib/data'
import { useHydrated } from '@/lib/hooks'
import { breachAbi, breachAddress, publicClient } from '@/lib/shared/chain'
import type { Pasal46Fields } from '@/lib/shared/types'
import { useControllerWallet } from '../wallet'
import { AI_UNAVAILABLE, BreachView, fieldsComplete, type CheckState, type DraftState, type Edited } from './BreachView'

const EMPTY_FIELDS: Pasal46Fields = { dataAffected: '', whenAndHow: '', actionsTaken: '', contact: '' }
const WINDOW_SEC = 72 * 3600

const CHECK_ERRORS: Record<string, string> = {
  DetectedInFuture: 'The detection time is in the future according to the chain clock.',
  NotAuthorized: 'This wallet is not the registered key for this controller.',
}

/**
 * Asks the BreachNotice contract whether an on-time anchor() would be accepted, by simulating it from the
 * connected wallet with a throwaway report hash. Nothing is signed, sent or stored.
 */
async function checkWithContract(input: BreachNoticeInput, account: `0x${string}`): Promise<{ late: boolean; deadlineSec: number }> {
  if (!publicClient || !breachAddress) throw new Error('The BreachNotice contract is not configured on this deployment.')
  const probe = (label: string) => keccak256(toHex(`saksi-check:${label}:${input.detectedAt}:${Math.random()}`))
  try {
    await publicClient.simulateContract({
      account,
      address: breachAddress,
      abi: breachAbi,
      functionName: 'anchor',
      args: [input.controllerId, probe('report'), probe('count'), BigInt(input.detectedAt)],
    })
    return { late: false, deadlineSec: input.detectedAt + WINDOW_SEC }
  } catch (e) {
    const revert = e instanceof BaseError ? e.walk((x) => x instanceof ContractFunctionRevertedError) : null
    if (revert instanceof ContractFunctionRevertedError && revert.data?.errorName) {
      const { errorName, args } = revert.data
      if (errorName === 'ClaimedWindowExpired') {
        const deadline = args?.[1]
        return { late: true, deadlineSec: typeof deadline === 'bigint' ? Number(deadline) : input.detectedAt + WINDOW_SEC }
      }
      if (!CHECK_ERRORS[errorName]) console.warn('[breach] check reverted:', errorName)
      throw new Error(CHECK_ERRORS[errorName] ?? 'The contract refused this notice. Check the detection time and try again.')
    }
    throw new Error('Could not reach the contract. Check your connection and try again.')
  }
}

/**
 * /controller/breach container. Handlers: onDraft, onCheckWithContract, onAnchor, onRecordLate,
 * onRetry, onReconfirm, onReset. The notice is sealed through useAnchorBreach (lib/client/controller.ts):
 * prepare → simulate → sign anchor() or, after the late approval, anchorLate() → submit → confirm.
 */
export function BreachNotice() {
  const { wallet, onConnect, onSwitchNetwork, onRefresh, onCopy } = useControllerWallet()
  const walletReady = wallet.state === 'ready' && !wallet.isChecking
  const { toast } = useToast()
  const hydrated = useHydrated()
  const breach = useAnchorBreach()

  const [narrative, setNarrative] = useState('')
  const [draft, setDraft] = useState<DraftState>({ status: 'idle' })
  const [aiRunId, setAiRunId] = useState<string | null>(null)
  const [fields, setFields] = useState<Pasal46Fields | null>(null)
  const [edited, setEdited] = useState<Edited>({})
  // Two minutes back by default: the chain clock trails wall time, and a detection time ahead of the
  // latest block is rejected as FUTURE_DETECTION.
  const [detectedAtSec, setDetectedAtSec] = useState(() => (typeof window === 'undefined' ? 0 : Math.floor(Date.now() / 1000) - 120))
  const [affected, setAffected] = useState('')
  const [checkState, setCheck] = useState<CheckState>({ status: 'idle' })
  const [mode, setMode] = useState<'on_time' | 'late' | null>(null)

  const tx = txViewFromState(breach.state)
  const busy = breach.isBusy
  const locked = busy || tx.phase === 'confirmed'
  // The contract can still answer "late" while sealing (the window closed after the check).
  const s = breach.state
  const lateDeadline = s.step === 'late' ? s.deadline : s.step === 'failed' ? s.lateApproval?.deadline : undefined
  const check: CheckState = lateDeadline !== undefined ? { status: 'late', deadlineSec: Number(lateDeadline) } : checkState
  const viewMode = lateDeadline !== undefined ? 'late' : mode

  /** Any input change after a check invalidates it (the contract verdict was for the old input). */
  const invalidate = () => {
    if (locked || !breach.reset()) return
    setCheck({ status: 'idle' })
    setMode(null)
  }

  const input = (): BreachNoticeInput | null => {
    const controllerId = wallet.controller?.id
    if (!controllerId || !fieldsComplete(fields) || !affected) return null
    return {
      controllerId,
      fields,
      detectedAt: detectedAtSec,
      affectedCount: Number(affected),
      ...(aiRunId ? { aiRunId } : {}),
    }
  }

  // Draft request counter: a stream whose id is no longer current (unmounted, reset, or superseded) is ignored.
  const draftReq = useRef(0)
  useEffect(() => () => void ++draftReq.current, [])

  const onDraft = async () => {
    if (draft.status === 'loading' || locked) return
    // Never redraft under a contract verdict or a seal: they are about the current text.
    if (check.status !== 'idle' && check.status !== 'error') return
    const controllerId = wallet.controller?.id
    if (!controllerId) {
      setDraft((d) => ({ ...d, status: 'error', error: 'Connect your registered controller wallet first.' }))
      return
    }
    const id = ++draftReq.current
    const current = () => id === draftReq.current
    // What the controller had before streaming, put back if this draft fails.
    const before = fields
    const restore = () => {
      setFields(before)
      setAiRunId(null)
    }
    setDraft((d) => ({ ...d, status: 'loading', error: undefined }))
    try {
      // The four parts fill in while the model writes; the validated result replaces them at the end.
      const out = await draftBreachStream(narrative, controllerId, (partial) => {
        if (current()) setFields({ ...EMPTY_FIELDS, ...partial })
      })
      if (!current()) return
      if (out.outOfScope) {
        restore()
        setDraft({ status: 'error', meta: out.meta, error: DRAFT_OUT_OF_SCOPE })
        return
      }
      // Template fallback with nothing in it: no AI wrote anything, so no "AI draft" boxes.
      if (out.meta?.fallbackLevel === 'template' && !Object.values(out.fields).some((v) => v.trim())) {
        restore()
        setDraft({ status: 'error', meta: out.meta, error: AI_UNAVAILABLE })
        return
      }
      setFields(out.fields)
      setEdited({})
      setAiRunId(out.aiRunId)
      setDraft({ status: 'done', meta: out.meta })
      invalidate()
    } catch (e) {
      if (!current()) return
      restore()
      setDraft((d) => ({ ...d, status: 'error', error: (e as Error).message }))
    }
  }

  const onCheckWithContract = async () => {
    const inp = input()
    if (!inp || !wallet.address || check.status === 'checking' || draft.status === 'loading') return
    setCheck({ status: 'checking' })
    try {
      const r = await checkWithContract(inp, wallet.address)
      setCheck({ status: r.late ? 'late' : 'on_time', deadlineSec: r.deadlineSec })
    } catch (e) {
      setCheck({ status: 'error', error: (e as Error).message })
    }
  }

  const settle = (state: TransactionState, m: 'on_time' | 'late') => {
    if (state.step === 'anchored') toast(m === 'late' ? 'Notice sealed as LATE' : 'Notice sealed on time')
    else if (state.step === 'failed' && state.error.code === 'rejected') toast('Signature rejected · nothing was sent', 'bad')
  }

  const runSeal = async (m: 'on_time' | 'late') => {
    // Never seal half-streamed text.
    if (busy || draft.status === 'loading') return
    // A pending late approval only needs the second step.
    if (m === 'late' && breach.state.step === 'late') {
      setMode('late')
      settle(await breach.recordLate(), 'late')
      return
    }
    const inp = input()
    if (!inp || !breach.reset()) return
    setMode(m)
    let state = await breach.anchor(inp)
    // anchor() simulates first; an expired window stops at 'late' until the controller approves anchorLate().
    if (m === 'late' && state.step === 'late') state = await breach.recordLate()
    settle(state, m)
  }

  const onAnchor = () => void runSeal('on_time')
  const onRecordLate = () => void runSeal('late')
  const onRetry = () => viewMode && void runSeal(viewMode)

  const onReconfirm = async () => {
    if (busy) return
    settle(await breach.reconfirm(), viewMode ?? 'on_time')
  }

  const onReset = () => {
    if (busy || !breach.reset()) return
    draftReq.current++ // drop a draft still streaming
    setNarrative('')
    setDraft({ status: 'idle' })
    setAiRunId(null)
    setFields(null)
    setEdited({})
    setAffected('')
    setDetectedAtSec(Math.floor(Date.now() / 1000) - 120)
    setCheck({ status: 'idle' })
    setMode(null)
  }

  return (
    <BreachView
      narrative={narrative}
      onNarrativeChange={setNarrative}
      draft={draft}
      onDraft={() => void onDraft()}
      fields={fields}
      edited={edited}
      onFieldChange={(k, v) => {
        if (locked) return
        setFields((cur) => ({ ...(cur ?? EMPTY_FIELDS), [k]: v }))
        setEdited((x) => ({ ...x, [k]: true }))
        invalidate()
      }}
      detectedAtSec={hydrated ? detectedAtSec : 0}
      onDetectedAtChange={(sec) => {
        if (locked) return
        setDetectedAtSec(sec)
        invalidate()
      }}
      affected={affected}
      onAffectedChange={(v) => {
        if (locked) return
        setAffected(v)
        invalidate()
      }}
      check={check}
      onCheckWithContract={() => void onCheckWithContract()}
      mode={viewMode}
      tx={tx}
      onAnchor={onAnchor}
      onRecordLate={onRecordLate}
      onRetry={onRetry}
      onReconfirm={() => void onReconfirm()}
      onReset={onReset}
      gate={(content) =>
        walletReady ? (
          content
        ) : (
          <WalletGate
            variant="inline"
            wallet={wallet}
            onConnect={onConnect}
            onSwitchNetwork={onSwitchNetwork}
            onRefresh={onRefresh}
            onCopy={onCopy}
          />
        )
      }
    />
  )
}
