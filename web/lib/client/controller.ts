'use client';

import { useState } from 'react';
import { useAccount, useConfig, useWriteContract } from 'wagmi';
import { getAccount } from 'wagmi/actions';
import { stringToHex, type Hash, type Hex } from 'viem';
import { sepolia } from 'viem/chains';
import { accessAbi, breachAbi, breachAddress, journalAddress, publicClient } from '../shared/chain';
import { createTransactionFlow, TransactionFlowError, type Confirmation, type TransactionState } from './transactions';

export type RecordAccessInput = {
  controllerId: Hex;
  subjectCode: string;
  purposeText: string;
  legalBasisKey: `PDP-20-2-${'a' | 'b' | 'c' | 'd' | 'e' | 'f'}`;
  eventType: 0 | 1 | 2 | 3;
};

export type AnchorBreachInput = {
  controllerId: Hex;
  fields: Record<string, unknown>;
  detectedAt: number;
  affectedCount: number;
  aiRunId?: string;
};

type AccessPreparation = { id: string; args: readonly [Hex, Hex, Hex, Hex, RecordAccessInput['eventType'], Hex] };
type BreachPreparation = { id: string; args: readonly [Hex, Hex, Hex, bigint] };
type Resource = 'access' | 'breach';
type Action = 'prepare' | 'submit' | 'confirm';

const bytes32 = (value: unknown): value is Hex => typeof value === 'string' && /^0x[0-9a-f]{64}$/i.test(value);
const isObject = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object';
const invalidResponse = () => new TransactionFlowError('api', 'The controller service returned an invalid response.');

async function post(resource: Resource, action: Action, body: object) {
  try {
    const response = await fetch(`/api/controller/${resource}/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    if (response.ok) return response;
  } catch { /* Keep transport details and request data out of UI errors. */ }
  throw new TransactionFlowError('api', `The controller service could not ${action} the transaction.`);
}

async function responseObject(response: Response) {
  let value: unknown;
  try { value = await response.json(); } catch { throw invalidResponse(); }
  if (!isObject(value)) throw invalidResponse();
  return value;
}

async function preparation(resource: Resource, body: object, argCount: number) {
  const { id, args } = await responseObject(await post(resource, 'prepare', body));
  if (typeof id !== 'string' || !id || !Array.isArray(args) || args.length !== argCount) throw invalidResponse();
  return { id, args: args as readonly unknown[] };
}

async function prepareAccess(input: RecordAccessInput): Promise<AccessPreparation> {
  const { controllerId: requestedId, subjectCode, purposeText, legalBasisKey: requestedBasis, eventType: requestedEvent } = input;
  const { id, args } = await preparation('access', {
    controllerId: requestedId, subjectCode, purposeText, legalBasisKey: requestedBasis, eventType: requestedEvent,
  }, 6);
  const [controllerId, subjectPseudonym, purposeHash, legalBasisKey, eventType, evidenceHash] = args;
  if (!bytes32(controllerId) || controllerId.toLowerCase() !== requestedId.toLowerCase() ||
    !bytes32(subjectPseudonym) || !bytes32(purposeHash) || !bytes32(legalBasisKey) || !bytes32(evidenceHash) ||
    legalBasisKey.toLowerCase() !== stringToHex(requestedBasis, { size: 32 }) || eventType !== requestedEvent) throw invalidResponse();
  return { id, args: [controllerId, subjectPseudonym, purposeHash, legalBasisKey, requestedEvent, evidenceHash] };
}

function uint64(value: unknown): bigint | undefined {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return BigInt(value);
  if (typeof value !== 'string' || !/^\d{1,20}$/.test(value)) return undefined;
  const parsed = BigInt(value);
  return parsed < 2n ** 64n ? parsed : undefined;
}

async function prepareBreach(input: AnchorBreachInput): Promise<BreachPreparation> {
  const { controllerId: requestedId, fields, detectedAt: requestedDetection, affectedCount, aiRunId } = input;
  const { id, args } = await preparation('breach', {
    controllerId: requestedId, fields, detectedAt: requestedDetection, affectedCount, aiRunId,
  }, 4);
  const [controllerId, reportHash, affectedCountHash, encodedDetectedAt] = args;
  const detectedAt = uint64(encodedDetectedAt);
  if (!bytes32(controllerId) || controllerId.toLowerCase() !== requestedId.toLowerCase() ||
    !bytes32(reportHash) || !bytes32(affectedCountHash) || detectedAt === undefined ||
    detectedAt !== uint64(requestedDetection)) throw invalidResponse();
  return { id, args: [controllerId, reportHash, affectedCountHash, detectedAt] };
}

function configured<T>(value: T | undefined): T {
  if (value === undefined) throw new TransactionFlowError('wallet', 'The Sepolia deployment is not configured.');
  return value;
}

function transactions(resource: Resource) {
  return {
    async submit(id: string, txHash: Hash) {
      await post(resource, 'submit', { id, txHash });
    },
    async wait(hash: Hash) {
      // B associates the preparation with the original hash, not with a replacement transaction.
      const receipt = await configured(publicClient).waitForTransactionReceipt({ hash, timeout: 60_000, checkReplacement: false });
      return receipt.status;
    },
    async confirm(id: string): Promise<Confirmation> {
      const { status, reason } = await responseObject(await post(resource, 'confirm', { id }));
      if (status === 'anchored') return { status };
      if (status === 'failed' && (reason === undefined || typeof reason === 'string')) return { status, reason };
      throw invalidResponse();
    },
  };
}

function useWriteFlow<Input, Prepared extends { id: string }>() {
  const [state, setState] = useState<TransactionState>({ step: 'idle' });
  const [flow] = useState(() => createTransactionFlow<Input, Prepared>(setState));
  const { address, connector } = useAccount();
  const config = useConfig();
  const { writeContractAsync } = useWriteContract({ mutation: { retry: false } });
  const isBusy = state.step !== 'idle' && state.step !== 'late' && state.step !== 'anchored' && state.step !== 'failed';

  function signer() {
    const current = getAccount(config);
    if (!address || !connector || !current.isConnected || current.address !== address ||
      current.connector !== connector || current.chainId !== sepolia.id) {
      throw new TransactionFlowError('wallet', 'Connect the original controller wallet on Sepolia to continue.');
    }
    return { account: address, connector, chainId: sepolia.id } as const;
  }

  return { state, flow, isBusy, signer, writeContractAsync };
}

const accessTransactions = transactions('access');
const breachTransactions = transactions('breach');

export function useRecordAccess() {
  const { state, flow, isBusy, signer, writeContractAsync } = useWriteFlow<RecordAccessInput, AccessPreparation>();
  return {
    state, isBusy, reconfirm: flow.reconfirm, reset: flow.reset,
    record(input: RecordAccessInput) {
      return flow.start(input, {
        ...accessTransactions,
        prepare(input) {
          signer();
          configured(publicClient);
          configured(journalAddress);
          return prepareAccess(input);
        },
        send({ args }) {
          return writeContractAsync({ ...signer(), address: configured(journalAddress), abi: accessAbi, functionName: 'logAccess', args });
        },
      });
    },
  };
}

export function useAnchorBreach() {
  const { state, flow, isBusy, signer, writeContractAsync } = useWriteFlow<AnchorBreachInput, BreachPreparation>();
  function request({ args }: BreachPreparation, mode: 'on_time' | 'late') {
    return {
      ...signer(), address: configured(breachAddress), abi: breachAbi,
      functionName: mode === 'late' ? 'anchorLate' : 'anchor', args,
    } as const;
  }

  return {
    state, isBusy, recordLate: flow.recordLate, reconfirm: flow.reconfirm, reset: flow.reset,
    anchor(input: AnchorBreachInput) {
      return flow.start(input, {
        ...breachTransactions,
        prepare(input) {
          signer();
          configured(publicClient);
          configured(breachAddress);
          return prepareBreach(input);
        },
        async simulate(prepared, mode) {
          await configured(publicClient).simulateContract(request(prepared, mode));
        },
        send(prepared, mode) {
          return writeContractAsync(request(prepared, mode));
        },
      });
    },
  };
}
