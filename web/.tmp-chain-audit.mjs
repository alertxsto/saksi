import { createPublicClient, http, keccak256, toBytes, parseAbi, parseAbiItem } from 'viem';
import { sepolia } from 'viem/chains';
const c = createPublicClient({ chain: sepolia, transport: http('https://ethereum-sepolia-rpc.publicnode.com') });
const REG='0x3d9dE4717a7398d24239b8370b23DCAd7a07f737', AJ='0xAb9b73586610697deb7Ae59A59e991f5177CB263', BR='0x71Ff16F068A845F3D3dfd63584a31A9de86fE462';
const abi = parseAbi(['function admin() view returns (address)','function bindings(bytes32) view returns (address,bool)']);
console.log('admin', await c.readContract({address:REG,abi,functionName:'admin'}));
for (const s of ['demo-one','demo-two','demo-spare','rsud-contoh','disdukcapil-kota-contoh']) {
  const id=keccak256(toBytes('ctrl:'+s)); console.log(s, await c.readContract({address:REG,abi,functionName:'bindings',args:[id]}));
}
const head = await c.getBlockNumber(); console.log('head', head);
const from=12181663n;
async function logs(address, event){ let out=[]; for(let b=from;b<=head;b+=40000n){ const to=b+39999n>head?head:b+39999n; out=out.concat(await c.getLogs({address,event:parseAbiItem(event),fromBlock:b,toBlock:to})); } return out; }
const reg = await logs(REG,'event ControllerRegistered(bytes32 indexed controllerId, address indexed eoa, string name)');
const rev = await logs(REG,'event ControllerRevoked(bytes32 indexed controllerId, address indexed eoa)');
for (const l of reg) console.log('REG', l.blockNumber, l.args.controllerId.slice(0,10), l.args.eoa, l.args.name);
for (const l of rev) console.log('REV', l.blockNumber, l.args.controllerId.slice(0,10), l.args.eoa);
const acc = await logs(AJ,'event AccessLogged(bytes32 indexed controllerId, bytes32 indexed subjectPseudonym, bytes32 indexed evidenceHash, bytes32 purposeHash, bytes32 legalBasisKey, uint8 eventType, uint64 timestamp)');
console.log('AccessLogged total', acc.length);
const byC={}; const ev=new Map(); for(const l of acc){byC[l.args.controllerId.slice(0,10)]=(byC[l.args.controllerId.slice(0,10)]||0)+1; ev.set(l.args.evidenceHash,(ev.get(l.args.evidenceHash)||0)+1);} console.log(byC, 'dupEvidence', [...ev.values()].filter(v=>v>1).length);
const b1 = await logs(BR,'event BreachAnchored(bytes32 indexed controllerId, bytes32 indexed reportHash, bytes32 affectedCountHash, uint64 detectedAt, uint64 anchoredAt, uint64 deadline)');
const b2 = await logs(BR,'event LateBreachAnchored(bytes32 indexed controllerId, bytes32 indexed reportHash, bytes32 affectedCountHash, uint64 detectedAt, uint64 anchoredAt, uint64 lateBy)');
console.log('BreachAnchored', b1.length, 'Late', b2.length);
for (const l of [...b1,...b2]) console.log(l.eventName, l.args.controllerId.slice(0,10), 'det', l.args.detectedAt, 'anch', l.args.anchoredAt, 'diff_h', Number(l.args.anchoredAt-l.args.detectedAt)/3600);
