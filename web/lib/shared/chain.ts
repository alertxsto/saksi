import {
  createPublicClient, decodeEventLog, fallback, getAddress, http, isAddress, zeroAddress,
  type Address, type Hex,
} from 'viem';
import { sepolia } from 'viem/chains';
import { accessAbi, breachAbi, registryAbi } from './abi';

export { accessAbi, breachAbi, registryAbi };

const rpcUrl = (value: string | undefined): value is string => {
  if (!value) return false;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && !url.hash;
  } catch { return false; }
};
const address = (value: string | undefined): Address | undefined =>
  value && isAddress(value) && value.toLowerCase() !== zeroAddress ? getAddress(value) : undefined;

export const rpcUrls: readonly string[] = [...new Set([
  process.env.NEXT_PUBLIC_RPC_PRIMARY,
  process.env.NEXT_PUBLIC_RPC_SECONDARY,
  process.env.NEXT_PUBLIC_RPC_TERTIARY,
].filter(rpcUrl))];
export const registryAddress = address(process.env.NEXT_PUBLIC_REGISTRY_ADDRESS);
export const journalAddress = address(process.env.NEXT_PUBLIC_JOURNAL_ADDRESS);
export const breachAddress = address(process.env.NEXT_PUBLIC_BREACH_ADDRESS);
const start = process.env.NEXT_PUBLIC_DEPLOY_BLOCK;
export const deployBlock = start && /^\d+$/.test(start) ? BigInt(start) : undefined;

const transport = (url: string) => http(url, { retryCount: 0, timeout: 4_000 });
const direct = (url: string) => createPublicClient({ chain: sepolia, transport: transport(url), cacheTime: 0 });
const nodes = rpcUrls.map(url => ({ url, client: direct(url) }));
export const publicClient = rpcUrls.length ? createPublicClient({
  chain: sepolia, transport: fallback(rpcUrls.map(transport), { retryCount: 0 }), cacheTime: 0,
}) : undefined;

export type ReceiptOpening = {
  eventId: string; controllerId: Hex; controllerName: string; subjectPseudonym: Hex;
  purposeText: string; purposeSalt: Hex; legalBasisKey: Hex; eventType: 0 | 1 | 2 | 3;
  evidence: Record<string, unknown>; txHash: Hex | null; logIndex: number | null;
  status: 'pending' | 'submitted' | 'anchored' | 'failed'; createdAt: string;
};
export type VerifyResult = {
  status: 'MATCH' | 'MISMATCH' | 'NOT_FOUND';
  mismatches: { field: 'eventType' | 'legalBasis' | 'purpose' | 'evidence' | 'pseudonym' | 'contract'; db: string; chain: string }[];
  blockNumber?: bigint; blockTime?: number; confirmations?: number; elapsedMs: number; rpc: string;
};
type Commitments = {
  purposeHash: (text: string, salt: Hex) => Hex;
  evidenceHash: (evidence: Record<string, unknown>) => Hex;
};
type Node = typeof nodes[number];
const bytes32 = (value: unknown): value is Hex => typeof value === 'string' && /^0x[\da-f]{64}$/i.test(value);
const equal = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const eventTypes = ['READ', 'UPDATE', 'EXPORT', 'SHARE_THIRD_PARTY'] as const;

async function findReceipt(txHash: Hex, candidates: readonly Node[]) {
  let rpc = '';
  for (const node of candidates) {
    rpc = node.url;
    try {
      const [chainId, receipt] = await Promise.all([
        node.client.getChainId(), node.client.getTransactionReceipt({ hash: txHash }),
      ]);
      if (chainId === sepolia.id && receipt) return { receipt, rpc, client: node.client };
    } catch { /* viem represents a null receipt as TransactionReceiptNotFoundError. */ }
  }
  return { receipt: null, rpc, client: undefined };
}

export async function getReceiptRobust(txHash: Hex) {
  const { receipt, rpc } = await findReceipt(txHash, nodes);
  return { receipt, rpc };
}

export function createReceiptVerifier(commitments: Commitments, config?: { urls: readonly string[]; journal: Address }) {
  const candidates = config ? config.urls.map(url => ({ url, client: direct(url) })) : nodes;
  const journal = config?.journal ?? journalAddress;
  return async function verifyReceipt(opening: ReceiptOpening): Promise<VerifyResult> {
    const started = performance.now();
    const elapsedMs = () => performance.now() - started;
    const unavailable = (rpc = ''): VerifyResult => ({ status: 'NOT_FOUND', mismatches: [], elapsedMs: elapsedMs(), rpc });
    if (!journal || !bytes32(opening.txHash) || typeof opening.logIndex !== 'number'
      || !Number.isSafeInteger(opening.logIndex) || opening.logIndex < 0) return unavailable();
    const { receipt, rpc, client } = await findReceipt(opening.txHash, candidates);
    if (!receipt || !client) return unavailable(rpc);
    const mismatches: VerifyResult['mismatches'] = [];
    const mismatch = (field: VerifyResult['mismatches'][number]['field'], db: string, chain: string) => {
      if (!equal(db, chain)) mismatches.push({ field, db, chain });
    };
    const altered = (): VerifyResult => ({ status: 'MISMATCH', mismatches, elapsedMs: elapsedMs(), rpc });
    if (receipt.status !== 'success' || !equal(receipt.transactionHash, opening.txHash)) {
      mismatch('contract', 'successful journal transaction', receipt.status === 'success' ? 'wrong transaction' : receipt.status);
      return altered();
    }
    mismatch('contract', journal, receipt.to ?? 'missing transaction target');
    if (mismatches.length) return altered();
    const log = receipt.logs.find(entry => entry.logIndex === opening.logIndex);
    if (!log || log.removed || !equal(log.address, journal)
      || log.blockHash !== receipt.blockHash || log.blockNumber !== receipt.blockNumber
      || !equal(log.transactionHash ?? '', opening.txHash)) {
      mismatches.push({ field: 'contract', db: journal, chain: log?.address ?? 'missing log' });
      return altered();
    }
    try {
      const { args } = decodeEventLog({ abi: accessAbi, eventName: 'AccessLogged', data: log.data, topics: log.topics });
      mismatch('contract', opening.controllerId, args.controllerId);
      mismatch('pseudonym', opening.subjectPseudonym, args.subjectPseudonym);
      mismatch('purpose', commitments.purposeHash(opening.purposeText, opening.purposeSalt), args.purposeHash);
      mismatch('legalBasis', opening.legalBasisKey, args.legalBasisKey);
      mismatch('evidence', commitments.evidenceHash(opening.evidence), args.evidenceHash);
      mismatch('eventType', eventTypes[opening.eventType] ?? String(opening.eventType), eventTypes[args.eventType] ?? String(args.eventType));
    } catch {
      mismatch('contract', 'decodable journal event and opening', 'invalid log or opening');
    }
    if (mismatches.length) return altered();
    try {
      const [block, head] = await Promise.all([
        client.getBlock({ blockNumber: receipt.blockNumber }), client.getBlockNumber({ cacheTime: 0 }),
      ]);
      if (block.hash !== receipt.blockHash || head < receipt.blockNumber) return unavailable(rpc);
      return { status: 'MATCH', mismatches, rpc, elapsedMs: elapsedMs(), blockNumber: receipt.blockNumber,
        blockTime: Number(block.timestamp), confirmations: Number(head - receipt.blockNumber + 1n) };
    } catch { return unavailable(rpc); }
  };
}

const accessEvent = accessAbi.find(item => item.type === 'event' && item.name === 'AccessLogged')!;
const onTimeEvent = breachAbi.find(item => item.type === 'event' && item.name === 'BreachAnchored')!;
const lateEvent = breachAbi.find(item => item.type === 'event' && item.name === 'LateBreachAnchored')!;
const registeredEvent = registryAbi.find(item => item.type === 'event' && item.name === 'ControllerRegistered')!;
const revokedEvent = registryAbi.find(item => item.type === 'event' && item.name === 'ControllerRevoked')!;
const maxBlocks = 10_000n;

function deployment() {
  if (deployBlock === undefined || !nodes.length || !journalAddress || !registryAddress || !breachAddress) {
    throw new Error('Sepolia deployment is not configured.');
  }
  return { first: deployBlock, client: nodes[0].client, journal: journalAddress, registry: registryAddress, breach: breachAddress };
}

function* ranges(first: bigint, head: bigint) {
  for (let fromBlock = first; fromBlock <= head; fromBlock += maxBlocks) {
    const end = fromBlock + maxBlocks - 1n;
    yield { fromBlock, toBlock: end < head ? end : head };
  }
}

export async function checkCompleteness(pseudonyms: readonly Hex[], openings: readonly ReceiptOpening[]) {
  if (!pseudonyms.length) return { onChain: 0, shownByServer: 0, missing: [] };
  const { first, client, journal } = deployment();
  const shown = new Set(openings.flatMap(o => o.txHash && o.logIndex !== null ? [`${o.txHash.toLowerCase()}:${o.logIndex}`] : []));
  const missing: { txHash: Hex; logIndex: number }[] = [];
  let onChain = 0;
  let shownByServer = 0;
  for (const range of ranges(first, await client.getBlockNumber())) {
    const logs = await client.getLogs({ ...range, address: journal, event: accessEvent, strict: true,
      args: { subjectPseudonym: pseudonyms } });
    for (const log of logs) {
      if (log.removed || log.transactionHash === null || log.logIndex === null) continue;
      onChain++;
      if (shown.has(`${log.transactionHash.toLowerCase()}:${log.logIndex}`)) shownByServer++;
      else missing.push({ txHash: log.transactionHash, logIndex: log.logIndex });
    }
  }
  return { onChain, shownByServer, missing };
}

export async function readBreach(reportHash: Hex) {
  const { first, client, breach } = deployment();
  const head = await client.getBlockNumber();
  const anchoredAt = await client.readContract({ address: breach, abi: breachAbi, functionName: 'anchoredAt', args: [reportHash], blockNumber: head });
  if (anchoredAt === 0n) return null;
  for (const range of ranges(first, head)) {
    const query = { ...range, address: breach, args: { reportHash }, strict: true } as const;
    const [[onTime], [late]] = await Promise.all([
      client.getLogs({ ...query, event: onTimeEvent }), client.getLogs({ ...query, event: lateEvent }),
    ]);
    if (onTime && onTime.args.anchoredAt === anchoredAt) return { mode: 'on_time' as const, anchoredAt, event: onTime };
    if (late && late.args.anchoredAt === anchoredAt) return { mode: 'late' as const, anchoredAt, event: late };
  }
  throw new Error('Breach event was not available from the configured RPC.');
}

export async function isAuthorizedAt(controllerId: Hex, eoa: Address, blockNumber: bigint, logIndex?: number) {
  const { first, client, registry } = deployment();
  // A receipt's log index excludes registry changes later in the same block.
  let active: Address | undefined;
  for (const range of ranges(first, blockNumber)) {
    const query = { ...range, address: registry, args: { controllerId }, strict: true } as const;
    const [registered, revoked] = await Promise.all([
      client.getLogs({ ...query, event: registeredEvent }), client.getLogs({ ...query, event: revokedEvent }),
    ]);
    const changes = [...registered, ...revoked];
    changes.sort((a, b) => a.blockNumber === b.blockNumber ? (a.logIndex ?? 0) - (b.logIndex ?? 0)
      : (a.blockNumber ?? 0n) < (b.blockNumber ?? 0n) ? -1 : 1);
    for (const log of changes) {
      if (log.removed || (logIndex !== undefined && log.blockNumber === blockNumber
        && (log.logIndex === null || log.logIndex >= logIndex))) continue;
      active = 'name' in log.args ? log.args.eoa : undefined;
    }
  }
  return active !== undefined && equal(active, eoa);
}

export async function findControllerName(controllerId: Hex, eoa: Address) {
  const { first, client, registry } = deployment();
  let name: string | undefined;
  for (const range of ranges(first, await client.getBlockNumber())) {
    const logs = await client.getLogs({ ...range, address: registry, event: registeredEvent, strict: true, args: { controllerId, eoa } });
    for (const log of logs) if (!log.removed) name = log.args.name;
  }
  return name;
}

export function downloadReceipt(opening: ReceiptOpening) {
  if (!journalAddress || !bytes32(opening.txHash) || opening.logIndex === null) throw new Error('A mined receipt is required.');
  const data = JSON.stringify({ chainId: sepolia.id, contractAddress: journalAddress, opening,
    instructions: 'Find AccessLogged at opening.logIndex in the Sepolia receipt. Compare the event with the opening and its recomputed hashes.' }, null, 2);
  const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `saksi-${opening.txHash}-${opening.logIndex}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
