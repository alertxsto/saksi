# Saksi contracts: security and cost notes

Scope: `src/ControllerRegistry.sol`, `src/AccessJournal.sol`, `src/BreachReport.sol` (118 SLOC, Solidity 0.8.24,
no dependencies, no assembly, no ETH handling). Reviewed at commit `c57c1d502e3ac926e2729ea1cab775fdb9148d38`;
the contract sources were not modified by this review.

| File | SHA-256 |
| --- | --- |
| `src/AccessJournal.sol` | `4fb4c56a8d1fc97a7dcc6bf8bf945d4ee831d7fe51eb4e8bd13c0acde0047159` |
| `src/BreachReport.sol` | `eff6fa99b7f07dd2654b447a9272c088f5581a08c275aa99d6bae1f9a84a096b` |
| `src/ControllerRegistry.sol` | `c45eafa1aaab7321753a44ba2bde9e878f8cff531b01f4c4fca3668e409d6fb4` |

This is a hackathon self-review, not a professional audit.

## 1. Static analysis (Slither)

| Item | Value |
| --- | --- |
| Tool | slither-analyzer 0.11.6, crytic-compile 0.4.2, Python 3.12.10 |
| Compiler | solc 0.8.24 through Foundry (forge 1.10.0); no solc-select needed |
| Command | `slither . --exclude-dependencies --json slither.json` (run in `contracts/`) |
| Detectors | all default detectors (Slither printed "3 contracts with 102 detectors") |
| Result | 0 high, 0 medium, 0 informational, 0 optimization, 3 low |

Slither invokes `forge clean` and rebuilds without `test/` and `script/`, so only `src/` is analysed.

| # | Detector | Impact / confidence | Location | Triage |
| --- | --- | --- | --- | --- |
| S-1 | `timestamp` | Low / Medium | `BreachReport.anchor`: `timestamp > lastOnTime` | False positive (accepted by design) |
| S-2 | `timestamp` | Low / Medium | `BreachReport.anchorLate`: `elapsed <= WINDOW` | False positive (accepted by design) |
| S-3 | `timestamp` | Low / Medium | `BreachReport._checkAnchor`: `detectedAt > block.timestamp`, `anchoredAt[reportHash] != 0` | False positive (accepted by design) |

Slither's line numbers for these results are 1 to 4 lines off from the source because the files use CRLF line
endings; the expressions above identify each finding exactly.

Triage reasoning for S-1 to S-3. Comparing against `block.timestamp` is the purpose of `BreachReport`: the
contract enforces the 72-hour notification window of UU 27/2022 Art. 46. The detector warns that block
producers can influence timestamps. On Ethereum proof-of-stake (Sepolia and mainnet), a block's timestamp is
fixed by its slot (`genesis_time + slot * 12`), so a proposer can at most choose which slot to include a
transaction in. That is seconds to minutes of influence against a 259,200-second window, and a controller can
avoid the edge by anchoring well before the deadline. The third comparison (`anchoredAt[reportHash] != 0`) is
flagged only because the stored value is a timestamp; it is a "set once" check and does not depend on clock
accuracy. No change needed.

## 2. Manual review

Slither covers known bug patterns, not the protocol's trust model. These are the findings from reading the
code. None is exploitable by an unregistered address.

| # | Severity | Finding | Status |
| --- | --- | --- | --- |
| M-1 | Low | `anchoredAt` is keyed by `reportHash` alone, not by `(controllerId, reportHash)`. A different registered controller that sees a pending `anchor` in the mempool can anchor the same hash first under its own id, so the victim's transaction reverts with `AlreadyAnchored`. | Accepted for the demo. Only admin-registered controllers can do this. The backend confirms a report only from the controller's own successful transaction whose event matches its `controllerId` and `reportHash` (`web/lib/server/breach.ts`), so the victim's report is marked failed, never falsely confirmed; re-preparing it adds a fresh nonce and therefore a new hash. A v2 fix is to key the mapping by `keccak256(abi.encode(controllerId, reportHash))`. |
| M-2 | Informational (trust assumption) | `detectedAt` is declared by the controller. The contract enforces that it is not in the future and that a report is classified once and never rewritten, but it cannot know when a breach was really detected. A controller that under-reports `detectedAt` can stay "on time". | By design. The on-chain record makes the claim public and permanent; regulators and subjects can dispute it against other evidence. The pitch must say "the window is enforced against the declared detection time". |
| M-3 | Low (centralization) | `admin` is one immutable EOA with no transfer function. If its key leaks, an attacker can revoke a controller and bind their own key under that id, then write receipts in its name. If the key is lost, no controller can ever be added or rotated. | Accepted for the demo. Earlier receipts are unaffected, and every rotation emits `ControllerRevoked` and `ControllerRegistered`, so Watch and auditors can see it. Production should use a multisig admin and a two-step admin transfer. |
| M-4 | Informational | `register` accepts `eoa == address(0)`, and `revoke` on an unknown or already-revoked id still emits `ControllerRevoked` (with `eoa` zero or repeated). | No authorization impact: `msg.sender` is never `address(0)`. Indexers should treat repeated revoke events as idempotent. |
| M-5 | Informational | `AccessJournal` stores nothing and accepts the same `evidenceHash` more than once. | By design: it is an append-only event log, about 34,700 gas per receipt. Uniqueness and completeness are checked off-chain by Watch, which compares DB rows with chain events. |

Checked and found safe:

- Reentrancy: the only external call is `registry.isAuthorized`, a view function on an immutable registry the
  deployer controls. No ETH is sent or received.
- Arithmetic: `deadline` is computed in `uint256` and clamped to `type(uint64).max`; `timestamp - detectedAt`
  cannot underflow because `_checkAnchor` rejects future `detectedAt`; `elapsed - WINDOW` runs only when
  `elapsed > WINDOW`. `uint64(block.timestamp)` truncates only after about the year 584,000,000,000.
- Ordering of checks: authorization runs before any timestamp arithmetic, and the duplicate check runs before
  the window check, so revert reasons cannot leak window state to unauthorized callers.
- Event schemas match the ABI used by the web verifier; `test/Saksi.t.sol` checks topic order.

## 3. Test coverage

Command: `forge test` in `contracts/`. Result on this machine: **27 tests passed, 0 failed, 0 skipped**
(3 suites, about 9 s).

| Suite | Kind | Count | What it proves |
| --- | --- | --- | --- |
| `test/Saksi.t.sol:SaksiTest` | Unit | 22 | Admin-only register/revoke; no overwrite of an active binding; key rotation; unauthorized and revoked controllers cannot log; event payload and topic order; `eventType` bound; exact deadline accepted by `anchor` and rejected by `anchorLate`; deadline + 1 s rejected by `anchor` with error args and accepted by `anchorLate`; duplicate rejected across both paths; authorization checked before timestamps; no overflow at `type(uint64).max`. |
| `test/SaksiProperties.t.sol:SaksiFuzzTest` | Fuzz (256 runs each) | 4 | Any address other than the bound EOA gets `NotAuthorized`; the bound EOA succeeds exactly for `eventType` 0 to 3; no non-admin can register or revoke; for any past `detectedAt`, exactly one of `anchor` and `anchorLate` succeeds and the accepted path matches `anchoredAt - detectedAt <= 72h`. |
| `test/SaksiProperties.t.sol:BreachInvariantTest` | Stateful invariant (64 runs x 200 calls = 12,800 calls) | 1 suite, 2 invariants | `invariant_reportAnchoredAtMostOnce`: a report hash is accepted at most once and its stored timestamp never changes. `invariant_classificationMatchesWindow`: every accepted report is on time iff it was anchored within 72 hours of its declared detection. The handler draws from 8 report hashes so duplicate attempts are frequent. |

The invariants were checked for vacuity by mutation: flipping the handler's recorded classification made
`invariant_classificationMatchesWindow` fail, and recording failed calls as successes made both invariants
fail. Both mutations were reverted.

Not covered: `script/Deploy.s.sol` has no test (it refuses to run off Sepolia), and there is no formal
verification.

## 4. Gas

`forge test --match-contract SaksiTest --gas-report` (forge 1.10.0, solc 0.8.24, optimizer off, EVM cancun):

| Function | Min | Avg | Median | Max | Calls |
| --- | --- | --- | --- | --- | --- |
| `AccessJournal.logAccess` | 29,951 | 31,460 | 30,158 | 33,539 | 5 |
| `BreachReport.anchor` | 29,624 | 44,357 | 55,416 | 55,466 | 11 |
| `BreachReport.anchorLate` | 29,483 | 40,259 | 32,161 | 55,580 | 8 |
| `ControllerRegistry.register` | 23,184 | 46,162 | 48,802 | 48,802 | 25 |
| `ControllerRegistry.revoke` | 22,066 | 27,207 | 28,921 | 28,921 | 4 |

Minimums are reverting calls; the successful-call figure is the max (or median for `anchor`). Deployment:
AccessJournal 282,788, BreachReport 494,966, ControllerRegistry 494,484 gas.

The same transactions sent to a throwaway local `anvil` chain (never a public network) with realistic inputs
(keccak hashes, so almost no zero calldata bytes) gave these receipt `gasUsed` values:

| Transaction | Receipt `gasUsed` | Gap to forge max, explained |
| --- | --- | --- |
| `logAccess` | 34,739 | +1,200 = 100 more non-zero calldata bytes x 12 gas |
| `anchor` | 56,160 | +744 = 62 more non-zero calldata bytes x 12 gas (vs median 55,416) |
| `anchorLate` | 56,336 | +756 (63 bytes) |
| `register` | 49,006 | +204 = 17 bytes (the test EOA `0xA11CE` is mostly zero bytes) |

So Foundry 1.x gas-report figures already include the 21,000 intrinsic gas and calldata; use the receipt
numbers for cost claims.

### Cost per record

`scripts/gas-cost.mjs` turns receipts or a gas figure into ETH and IDR. It takes no hardcoded prices.

```sh
# From real Sepolia transactions:
node scripts/gas-cost.mjs --rpc "$SEPOLIA_RPC_URL" --tx 0x... --tx 0x... --eth-idr <IDR per ETH> --mainnet-gwei <gwei> --l2-factor <ratio>
# From a gas figure:
node scripts/gas-cost.mjs --gas 34739 --eth-idr <IDR per ETH> --mainnet-gwei <gwei> --l2-factor <ratio>
```

Example output with **illustrative** inputs (1 ETH = IDR 50,000,000, mainnet 2 gwei, L2 at 2% of L1). These
are not market quotes; rerun with the day's prices and real Sepolia hashes before quoting numbers on stage.

| One access receipt (`logAccess`, 34,739 gas) | Per record | Per 1,000 records |
| --- | --- | --- |
| Ethereum L1 at 2 gwei | 0.000069478 ETH = IDR 3,473.90 | 0.069478 ETH = IDR 3,473,900 |
| L2 at 0.02 x L1 | 0.00000138956 ETH = IDR 69.48 | 0.00138956 ETH = IDR 69,478 |

A breach anchor costs about 56,200 gas, roughly 1.6 times one access receipt, but happens once per incident.

## 5. Reproduce

```sh
cd contracts
forge test                                              # 27 passed
forge test --match-contract SaksiTest --gas-report      # gas table above
python -m venv ~/.venvs/slither && ~/.venvs/slither/Scripts/pip install slither-analyzer==0.11.6
~/.venvs/slither/Scripts/slither . --exclude-dependencies   # 3 low (timestamp), see triage
```

On Linux or macOS the venv executables are in `~/.venvs/slither/bin/`. Keep the venv outside the repo.
