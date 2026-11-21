import 'server-only';
import { eq } from 'drizzle-orm';
import { type Hex } from 'viem';
import { db } from '../../db/client';
import { controllers } from '../../db/schema';
import { events, rpc, addresses, deployBlock } from './chain';
import { HttpError } from './http';
import { controllerId } from '../shared/commit';
const slugify = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
/**
 * The registry stores only the id and a display name. Recover the slug when the id is keccak256("ctrl:" + slug) of the
 * name, with or without a trailing note such as "(fiktif)"; otherwise the id itself stands in as the unique slug.
 */
export function inferSlug(id: Hex, name: string) {
  const candidates = [slugify(name), slugify(name.replace(/\s*\([^)]*\)\s*$/, ''))];
  return candidates.find((slug) => slug && controllerId(slug) === id) ?? id;
}
export async function controller(id: Hex) {
  const [local] = await db().select().from(controllers).where(eq(controllers.id, id));
  if (local) return local;
  const client = rpc();
  const address = addresses().registry;
  const head = await client.getBlockNumber();
  const baseline = deployBlock();
  for (let toBlock = head; toBlock >= baseline;) {
    const fromBlock = toBlock - baseline >= 9_999n ? toBlock - 9_999n : baseline;
    const [registrations, revocations] = await Promise.all([
      client.getLogs({ address, event: events[3], args: { controllerId: id }, fromBlock, toBlock, strict: true }),
      client.getLogs({ address, event: events[4], args: { controllerId: id }, fromBlock, toBlock, strict: true }),
    ]);
    const registration = registrations.at(-1);
    const revocation = revocations.at(-1);
    const last = !registration || (revocation && (revocation.blockNumber > registration.blockNumber ||
      (revocation.blockNumber === registration.blockNumber && revocation.logIndex > registration.logIndex))) ? revocation : registration;
    if (last?.eventName === 'ControllerRevoked') break;
    if (last?.eventName === 'ControllerRegistered') {
      const name = last.args.name;
      const row = { id, name, slug: inferSlug(id, name), eoa: last.args.eoa.toLowerCase(), registryTx: last.transactionHash };
      await db().insert(controllers).values(row).onConflictDoNothing({ target: controllers.id });
      return row;
    }
    toBlock = fromBlock - 1n;
  }
  throw new HttpError(404, 'UNKNOWN_CONTROLLER', 'Controller is not registered on Sepolia.');
}
