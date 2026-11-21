#!/usr/bin/env node
/*
 * gas-cost.mjs - cost per Saksi record, measured from real transactions or a gas figure.
 *
 * Usage (run from the repo root; viem is loaded from web/node_modules):
 *
 *   # Real transactions: fetch receipts and use gasUsed * effectiveGasPrice (+ l1Fee on OP-stack L2s)
 *   node scripts/gas-cost.mjs --rpc "$SEPOLIA_RPC_URL" --tx 0xabc... --tx 0xdef... \
 *     --eth-idr <IDR per 1 ETH> [--mainnet-gwei <gwei>] [--l2-factor <ratio>]
 *
 *   # No transaction: project from a gas number (e.g. from `forge test --gas-report`)
 *   node scripts/gas-cost.mjs --gas 55000 --eth-idr <IDR per 1 ETH> --mainnet-gwei <gwei> \
 *     [--gwei <observed gwei>] [--l2-factor <ratio>]
 *
 * Options:
 *   --rpc <url>          JSON-RPC endpoint. Required with --tx.
 *   --tx <hash>          Transaction hash; repeat for several. Use either --tx or --gas, not both.
 *                        Each successful tx counts as one record (every Saksi write emits exactly one
 *                        event). Reverted txs are reported but excluded from the per-record average
 *                        because they record nothing.
 *   --gas <n>            Gas units per record; repeat for several. Treated as a full transaction's
 *                        gasUsed. Foundry 1.x `forge test --gas-report` figures already include the
 *                        21,000 intrinsic gas and calldata (checked against local anvil receipts); they
 *                        run slightly low only because test inputs have more zero calldata bytes.
 *   --gwei <n>           Gas price for --gas rows (e.g. the Sepolia price you observed). Optional.
 *   --eth-idr <n>        Required. Price of 1 ETH in Indonesian rupiah. No price is hardcoded.
 *   --mainnet-gwei <n>   Ethereum L1 mainnet gas price for the projection. Required with --gas.
 *   --l2-factor <n>      L2 cost as a fraction of the L1 projection (e.g. 0.02 = 2%). Illustrative only:
 *                        real L2 fees depend on the rollup's execution and data (blob) prices.
 *   --json               Print machine-readable JSON instead of the text report.
 *   --help               Print this help.
 *
 * Testnet (Sepolia) ETH has no market value; the IDR figures for --tx rows on a testnet show what the same
 * gas would cost if paid at that gas price with real ETH. The L1/L2 projections are the realistic numbers.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const require = createRequire(new URL('../web/package.json', import.meta.url));
const { createPublicClient, formatEther, formatGwei, http, isHash, parseGwei } = require('viem');

const RECORDS_PER_BATCH = 1000n;
const WEI_PER_ETH = 10n ** 18n;

function usage() {
  const source = readFileSync(fileURLToPath(import.meta.url), 'utf8');
  const block = source.slice(source.indexOf('/*') + 2, source.indexOf('*/'));
  return block.split('\n').map((line) => line.replace(/^ ?\* ?/, '')).join('\n').trim();
}

function fail(message) {
  console.error(`error: ${message}\n\nRun with --help for usage.`);
  process.exit(2);
}

function positiveNumber(name, raw, { allowZero = false } = {}) {
  if (raw === undefined) return undefined;
  const value = Number(raw);
  if (raw.trim() === '' || !Number.isFinite(value) || value < 0 || (!allowZero && value === 0)) {
    fail(`--${name} must be a ${allowZero ? 'non-negative' : 'positive'} number, got "${raw}"`);
  }
  return value;
}

function gweiToWei(name, raw) {
  positiveNumber(name, raw);
  try {
    return parseGwei(raw.trim());
  } catch {
    fail(`--${name} must be a plain decimal gwei amount, got "${raw}"`);
  }
}

function gasUnits(raw) {
  if (!/^\d+$/.test(raw.trim()) || BigInt(raw.trim()) === 0n) fail(`--gas must be a positive integer, got "${raw}"`);
  return BigInt(raw.trim());
}

function parseCli(argv) {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      strict: true,
      options: {
        rpc: { type: 'string' },
        tx: { type: 'string', multiple: true },
        gas: { type: 'string', multiple: true },
        gwei: { type: 'string' },
        'eth-idr': { type: 'string' },
        'mainnet-gwei': { type: 'string' },
        'l2-factor': { type: 'string' },
        json: { type: 'boolean' },
        help: { type: 'boolean' },
      },
    }).values;
  } catch (error) {
    fail(error.message);
  }
  if (parsed.help) {
    console.log(usage());
    process.exit(0);
  }

  const txs = parsed.tx ?? [];
  const gas = (parsed.gas ?? []).map(gasUnits);
  if (txs.length === 0 && gas.length === 0) fail('pass at least one --tx or --gas');
  if (txs.length > 0 && gas.length > 0) fail('use either --tx or --gas, not both');
  if (txs.length > 0 && !parsed.rpc) fail('--rpc is required with --tx');
  for (const hash of txs) if (!isHash(hash)) fail(`--tx must be a 32-byte 0x-prefixed hash, got "${hash}"`);
  if (parsed['eth-idr'] === undefined) fail('--eth-idr is required (IDR price of 1 ETH)');
  if (gas.length > 0 && parsed['mainnet-gwei'] === undefined) fail('--mainnet-gwei is required with --gas');
  if (parsed.gwei !== undefined && gas.length === 0) fail('--gwei only applies to --gas rows');

  return {
    rpc: parsed.rpc,
    txs,
    gas,
    gweiWei: parsed.gwei === undefined ? undefined : gweiToWei('gwei', parsed.gwei),
    ethIdr: positiveNumber('eth-idr', parsed['eth-idr']),
    mainnetWei: parsed['mainnet-gwei'] === undefined ? undefined : gweiToWei('mainnet-gwei', parsed['mainnet-gwei']),
    l2Factor: positiveNumber('l2-factor', parsed['l2-factor']),
    json: Boolean(parsed.json),
  };
}

function toBigInt(value) {
  if (value === undefined || value === null) return 0n;
  return typeof value === 'bigint' ? value : BigInt(value);
}

async function fetchTxRows(rpc, hashes) {
  const client = createPublicClient({ transport: http(rpc) });
  return Promise.all(
    hashes.map(async (hash) => {
      const receipt = await client.getTransactionReceipt({ hash });
      let price = toBigInt(receipt.effectiveGasPrice);
      if (price === 0n) price = toBigInt((await client.getTransaction({ hash })).gasPrice);
      const l1Fee = toBigInt(receipt.l1Fee);
      return {
        source: 'tx',
        id: hash,
        block: receipt.blockNumber,
        status: receipt.status,
        logs: receipt.logs.length,
        gasUsed: receipt.gasUsed,
        gasPriceWei: price,
        l1FeeWei: l1Fee,
        costWei: receipt.gasUsed * price + l1Fee,
      };
    }),
  );
}

function gasRows(gas, priceWei) {
  return gas.map((units, index) => ({
    source: 'gas',
    id: `--gas #${index + 1}`,
    status: 'success',
    gasUsed: units,
    gasPriceWei: priceWei,
    l1FeeWei: 0n,
    costWei: priceWei === undefined ? undefined : units * priceWei,
  }));
}

/** Wei to IDR for display. Splitting whole ETH from the fraction keeps float error negligible. */
function weiToIdr(wei, ethIdr) {
  const whole = Number(wei / WEI_PER_ETH);
  const fraction = Number(wei % WEI_PER_ETH) / 1e18;
  return (whole + fraction) * ethIdr;
}

function money(wei, ethIdr) {
  return { wei: wei.toString(), eth: formatEther(wei), idr: weiToIdr(wei, ethIdr) };
}

function summarize(rows, config) {
  const counted = rows.filter((row) => row.status === 'success');
  const avgGas = counted.length === 0 ? undefined : counted.reduce((sum, row) => sum + row.gasUsed, 0n) / BigInt(counted.length);
  const priced = counted.filter((row) => row.costWei !== undefined);
  const avgCost = priced.length === 0 ? undefined : priced.reduce((sum, row) => sum + row.costWei, 0n) / BigInt(priced.length);

  const result = { records: counted.length, avgGasPerRecord: avgGas?.toString() };
  if (avgCost !== undefined) {
    result.measured = { perRecord: money(avgCost, config.ethIdr), per1000: money(avgCost * RECORDS_PER_BATCH, config.ethIdr) };
  }
  if (avgGas !== undefined && config.mainnetWei !== undefined) {
    const l1 = avgGas * config.mainnetWei;
    result.l1Mainnet = {
      gwei: formatGwei(config.mainnetWei),
      perRecord: money(l1, config.ethIdr),
      per1000: money(l1 * RECORDS_PER_BATCH, config.ethIdr),
    };
    if (config.l2Factor !== undefined) {
      // Scale in parts-per-billion to keep wei arithmetic in BigInt.
      const ppb = BigInt(Math.round(config.l2Factor * 1e9));
      const l2 = (l1 * ppb) / 1_000_000_000n;
      result.l2Projection = {
        factor: config.l2Factor,
        perRecord: money(l2, config.ethIdr),
        per1000: money(l2 * RECORDS_PER_BATCH, config.ethIdr),
      };
    }
  }
  return result;
}

const idrFormat = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const smallIdrFormat = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 4 });
const formatIdr = (idr) => `IDR ${idr !== 0 && Math.abs(idr) < 1 ? smallIdrFormat.format(idr) : idrFormat.format(idr)}`;
const line = (label, pair) =>
  `  ${label.padEnd(16)} ${`${pair.eth} ETH`.padEnd(28)} ${formatIdr(pair.idr)}`;

function printText(rows, summary, config) {
  console.log(`Saksi cost per record (1 ETH = ${formatIdr(config.ethIdr)})\n`);
  console.log('Inputs:');
  for (const row of rows) {
    const price = row.gasPriceWei === undefined ? 'no gas price' : `${formatGwei(row.gasPriceWei)} gwei`;
    const extra = row.source === 'tx' ? `, block ${row.block}, ${row.logs} log(s)` : '';
    const l1 = row.l1FeeWei > 0n ? `, l1Fee ${formatEther(row.l1FeeWei)} ETH` : '';
    const cost = row.costWei === undefined ? '' : ` -> ${formatEther(row.costWei)} ETH`;
    const flag = row.status === 'success' ? '' : `  [${row.status}: excluded]`;
    console.log(`  ${row.id}: gas ${row.gasUsed} @ ${price}${l1}${extra}${cost}${flag}`);
  }
  console.log(`\nRecords counted: ${summary.records}; average gas per record: ${summary.avgGasPerRecord ?? 'n/a'}`);
  if (summary.measured) {
    const label = config.txs.length > 0 ? 'Measured (receipts, at the gas price actually paid):' : 'At --gwei:';
    console.log(`\n${label}`);
    console.log(line('per record', summary.measured.perRecord));
    console.log(line('per 1,000', summary.measured.per1000));
  }
  if (summary.l1Mainnet) {
    console.log(`\nEthereum L1 mainnet projection at ${summary.l1Mainnet.gwei} gwei:`);
    console.log(line('per record', summary.l1Mainnet.perRecord));
    console.log(line('per 1,000', summary.l1Mainnet.per1000));
  }
  if (summary.l2Projection) {
    console.log(`\nL2 projection (${summary.l2Projection.factor} x L1 cost, illustrative):`);
    console.log(line('per record', summary.l2Projection.perRecord));
    console.log(line('per 1,000', summary.l2Projection.per1000));
  }
  if (rows.some((row) => row.source === 'gas')) {
    console.log('\nNote: --gas is priced as full-transaction gasUsed. Confirm it with real receipts via --tx.');
  }
}

const jsonSafe = (_key, value) => (typeof value === 'bigint' ? value.toString() : value);

async function main() {
  const config = parseCli(process.argv.slice(2));
  const rows = [...(config.txs.length > 0 ? await fetchTxRows(config.rpc, config.txs) : []), ...gasRows(config.gas, config.gweiWei)];
  const summary = summarize(rows, config);
  if (summary.records === 0) {
    console.error('error: no successful transactions to price.');
    process.exit(1);
  }
  if (config.json) console.log(JSON.stringify({ rows, summary }, jsonSafe, 2));
  else printText(rows, summary, config);
}

main().catch((error) => {
  console.error(`error: ${error.shortMessage ?? error.message}`);
  process.exit(1);
});
