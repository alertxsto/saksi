import type { Address, Hex } from 'viem';

export type Controller = { controllerId: Hex; name: string; balance: bigint };
export type WalletStatus =
  | { state: 'no_wallet' | 'disconnected' }
  | { state: 'wrong_network'; address: Address; chainId: number | undefined }
  | { state: 'not_registered'; address: Address }
  | ({ state: 'no_gas' | 'ready'; address: Address } & Controller);

export type WalletInputs = {
  injectedWallet: boolean | undefined;
  isConnected: boolean;
  address: Address | undefined;
  chainId: number | undefined;
  expectedChainId: number;
  minimumBalance: bigint;
  // The last successful registry check: null means "not registered", undefined means "not known yet".
  // A failed refetch keeps the previous data, so a flaky RPC never turns a registered wallet into not_registered;
  // the failure is reported separately through checkError.
  registry: Controller | null | undefined;
};

export function walletStatus({ injectedWallet, isConnected, address, chainId, expectedChainId, minimumBalance, registry }: WalletInputs): WalletStatus {
  if (injectedWallet === false) return { state: 'no_wallet' };
  if (injectedWallet === undefined || !isConnected || !address) return { state: 'disconnected' };
  if (chainId !== expectedChainId) return { state: 'wrong_network', address, chainId };
  if (!registry) return { state: 'not_registered', address };
  return { state: registry.balance < minimumBalance ? 'no_gas' : 'ready', address, ...registry };
}
