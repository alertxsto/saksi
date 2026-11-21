import { once } from 'node:events';
import { createServer, type Server } from 'node:http';
import { afterEach, expect, test, vi } from 'vitest';
import { encodeAbiParameters, encodeEventTopics, parseAbiItem, type Address, type Hex } from 'viem';
import { createReceiptVerifier, type ReceiptOpening } from '../lib/shared/chain';
import { evidenceHash, purposeHash } from '../lib/shared/commit';

const hash = (n: number): Hex => `0x${n.toString(16).padStart(64, '0')}`;
const journal: Address = '0x0000000000000000000000000000000000000001';
const event = parseAbiItem('event AccessLogged(bytes32 indexed controllerId, bytes32 indexed subjectPseudonym, bytes32 indexed evidenceHash, bytes32 purposeHash, bytes32 legalBasisKey, uint8 eventType, uint64 timestamp)');
const opening: ReceiptOpening = {
  eventId: 'event', controllerId: hash(1), controllerName: 'Demo', subjectPseudonym: hash(2),
  purposeText: 'Service', purposeSalt: hash(6), legalBasisKey: hash(4), eventType: 0, evidence: { note: 'synthetic' },
  txHash: hash(10), logIndex: 1, status: 'anchored', createdAt: '2026-01-01T00:00:00Z',
};
const commitments = { purposeHash: () => hash(3), evidenceHash: () => hash(5) };
const block = { hash: hash(11), number: '0x2', timestamp: '0x123' };
const receipt = {
  status: '0x1', to: journal, transactionHash: hash(10), blockNumber: block.number, blockHash: block.hash,
  logs: [{
    address: journal, blockHash: block.hash, blockNumber: block.number, transactionHash: hash(10),
    transactionIndex: '0x0', logIndex: '0x1', removed: false,
    topics: encodeEventTopics({ abi: [event], eventName: 'AccessLogged',
      args: { controllerId: hash(1), subjectPseudonym: hash(2), evidenceHash: hash(5) } }),
    data: encodeAbiParameters([{ type: 'bytes32' }, { type: 'bytes32' }, { type: 'uint8' }, { type: 'uint64' }], [hash(3), hash(4), 0, 291n]),
  }],
};
const servers: Server[] = [];
afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(servers.splice(0).map(async server => {
    const closed = once(server, 'close');
    server.close();
    await closed;
  }));
});

async function rpc(result: unknown, logs?: (topic: string) => unknown) {
  const server = createServer(async (req, res) => {
    let data = '';
    for await (const chunk of req) data += chunk;
    const { id, method, params } = JSON.parse(data);
    const value = method === 'eth_getLogs' ? logs?.(params[0].topics[0]) :
      ({ eth_chainId: '0xaa36a7', eth_getTransactionReceipt: result,
        eth_getBlockByNumber: block, eth_blockNumber: '0x3' } as Record<string, unknown>)[method];
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ jsonrpc: '2.0', id, result: value ?? null }));
  });
  servers.push(server);
  const listening = once(server, 'listening');
  server.listen(0, '127.0.0.1');
  await listening;
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('Test RPC did not start');
  return `http://127.0.0.1:${address.port}`;
}

test('a null receipt at the first RPC does not hide the proven event from the second RPC', async () => {
  const missing = await rpc(null);
  const found = await rpc(receipt);
  const verify = createReceiptVerifier(commitments, { urls: [missing, found], journal });
  await expect(verify(opening)).resolves.toMatchObject({ status: 'MATCH', rpc: found, blockNumber: 2n, blockTime: 291, confirmations: 2 });
  await expect(verify({ ...opening, eventType: 3 })).resolves.toMatchObject({
    status: 'MISMATCH', mismatches: [{ field: 'eventType', db: 'SHARE_THIRD_PARTY', chain: 'READ' }],
  });
});

test('recomputes real commitments and detects Share with third party edited to Read', async () => {
  const syntheticPurpose = '0x25c362b1cf9caaae96629d2d20e9876c947a733904386ef688397c58dc68f94f';
  const syntheticEvidence = '0x67e530b14f1b82dddec04e72a67b1ab1d0e813bee4df960b70a9554afad45fca';
  const log = receipt.logs[0];
  const found = await rpc({ ...receipt, logs: [{
    ...log,
    topics: encodeEventTopics({ abi: [event], eventName: 'AccessLogged',
      args: { controllerId: opening.controllerId, subjectPseudonym: opening.subjectPseudonym, evidenceHash: syntheticEvidence } }),
    data: encodeAbiParameters([{ type: 'bytes32' }, { type: 'bytes32' }, { type: 'uint8' }, { type: 'uint64' }],
      [syntheticPurpose, opening.legalBasisKey, 3, 291n]),
  }] });
  const verify = createReceiptVerifier({ purposeHash, evidenceHash }, { urls: [found], journal });
  const original = { ...opening, eventType: 3 } as const;
  await expect(verify(original)).resolves.toMatchObject({ status: 'MATCH' });
  await expect(verify({ ...original, eventType: 0 })).resolves.toMatchObject({
    status: 'MISMATCH', mismatches: [{ field: 'eventType', db: 'READ', chain: 'SHARE_THIRD_PARTY' }],
  });
  await expect(verify({ ...original, purposeText: 'Different purpose', evidence: { note: 'changed' } }))
    .resolves.toMatchObject({ status: 'MISMATCH', mismatches: [{ field: 'purpose' }, { field: 'evidence' }] });
});

test('event from a different contract or proof at a different index cannot match', async () => {
  const different = await rpc({ ...receipt, to: '0x0000000000000000000000000000000000000002' });
  await expect(createReceiptVerifier(commitments, { urls: [different], journal })(opening))
    .resolves.toMatchObject({ status: 'MISMATCH', mismatches: [{ field: 'contract' }] });
  const found = await rpc(receipt);
  await expect(createReceiptVerifier(commitments, { urls: [found], journal })({ ...opening, logIndex: 0 }))
    .resolves.toMatchObject({ status: 'MISMATCH' });
});

test('a missing receipt on every RPC is unavailable, not altered', async () => {
  const verify = createReceiptVerifier(commitments, { urls: [await rpc(null)], journal });
  await expect(verify(opening)).resolves.toMatchObject({ status: 'NOT_FOUND', mismatches: [] });
});

test('same-block revocation does not change who was authorized at the receipt log', async () => {
  const controller = '0x0000000000000000000000000000000000000002';
  const registered = parseAbiItem('event ControllerRegistered(bytes32 indexed controllerId, address indexed eoa, string name)');
  const revoked = parseAbiItem('event ControllerRevoked(bytes32 indexed controllerId, address indexed eoa)');
  const args = { controllerId: opening.controllerId, eoa: controller } as const;
  const before = encodeEventTopics({ abi: [registered], eventName: 'ControllerRegistered', args });
  const after = encodeEventTopics({ abi: [revoked], eventName: 'ControllerRevoked', args });
  const common = { address: journal, blockHash: block.hash, blockNumber: '0x2',
    transactionHash: hash(20), transactionIndex: '0x0', removed: false };
  const url = await rpc(null, topic => topic === before[0]
    ? [{ ...common, logIndex: '0x0', topics: before, data: encodeAbiParameters([{ type: 'string' }], ['Demo']) }]
    : [{ ...common, logIndex: '0x2', topics: after, data: '0x' }]);
  vi.stubEnv('NEXT_PUBLIC_RPC_PRIMARY', url);
  vi.stubEnv('NEXT_PUBLIC_REGISTRY_ADDRESS', journal);
  vi.stubEnv('NEXT_PUBLIC_JOURNAL_ADDRESS', journal);
  vi.stubEnv('NEXT_PUBLIC_BREACH_ADDRESS', journal);
  vi.stubEnv('NEXT_PUBLIC_DEPLOY_BLOCK', '1');
  vi.resetModules();
  // Reload the module after installing the test RPC in its environment.
  const { isAuthorizedAt } = await import('../lib/shared/chain');
  await expect(isAuthorizedAt(opening.controllerId, controller, 2n, 1)).resolves.toBe(true);
  await expect(isAuthorizedAt(opening.controllerId, controller, 2n)).resolves.toBe(false);
});
