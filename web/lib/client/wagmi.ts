'use client';

import { useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createConfig, useAccount, useConnect, useSwitchChain } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { fallback, http, parseEther, type Address, type Hex } from 'viem';
import { sepolia } from 'viem/chains';
import { deployBlock, findControllerName, publicClient, registryAbi, registryAddress, rpcUrls } from '../shared/chain';

export { useAnchorBreach, useRecordAccess, type AnchorBreachInput, type RecordAccessInput } from './controller';
export type { TransactionError, TransactionState } from './transactions';

export const wagmiConfig = rpcUrls.length ? createConfig({
  chains: [sepolia],
  connectors: [injected()],
  transports: { [sepolia.id]: fallback(rpcUrls.map((url) => http(url))) },
  ssr: true,
  multiInjectedProviderDiscovery: false,
}) : undefined;

const minimumBalance = parseEther('0.002');

type Controller = { controllerId: Hex; name: string; balance: bigint };
type WalletStatus =
  | { state: 'no_wallet' | 'disconnected' }
  | { state: 'wrong_network'; address: Address; chainId: number | undefined }
  | { state: 'not_registered'; address: Address }
  | ({ state: 'no_gas' | 'ready'; address: Address } & Controller);

export type WalletState = WalletStatus & {
  isChecking: boolean;
  checkError: Error | null;
  isConnecting: boolean;
  isSwitching: boolean;
  connect: () => Promise<void>;
  switchToSepolia: () => Promise<void>;
  refresh: () => Promise<void>;
};

function hasInjectedWallet() {
  return Boolean((window as Window & { ethereum?: unknown }).ethereum);
}

function subscribeInjectedWallet(notify: () => void) {
  window.addEventListener('ethereum#initialized', notify);
  return () => window.removeEventListener('ethereum#initialized', notify);
}

async function readController(address: Address, controllerIds: readonly Hex[]): Promise<Controller | null> {
  const client = publicClient;
  const registry = registryAddress;
  if (!client || !registry || deployBlock === undefined) throw new Error('The Sepolia registry is not configured.');
  const authorized = await Promise.all(controllerIds.map((controllerId) => client.readContract({
    address: registry,
    abi: registryAbi,
    functionName: 'isAuthorized',
    args: [controllerId, address],
  })));
  const controllerId = controllerIds[authorized.indexOf(true)];
  if (!controllerId) return null;
  const [name, balance] = await Promise.all([
    findControllerName(controllerId, address),
    client.getBalance({ address }),
  ]);
  if (name === undefined) throw new Error('The controller registration could not be read from Sepolia.');
  return { controllerId, name, balance };
}

export function useWalletState(controllerIds: readonly Hex[]): WalletState {
  const injectedWallet = useSyncExternalStore<boolean | undefined>(subscribeInjectedWallet, hasInjectedWallet, () => undefined);
  const account = useAccount();
  const { connectors, connectAsync, isPending: isConnecting } = useConnect({ mutation: { retry: false } });
  const { switchChainAsync, isPending: isSwitching } = useSwitchChain({ mutation: { retry: false } });
  const address = account.address;
  const canInspect = Boolean(injectedWallet && address && account.isConnected && account.chainId === sepolia.id);
  const registry = useQuery({
    queryKey: ['saksi-wallet', sepolia.id, address, controllerIds],
    enabled: canInspect,
    queryFn: () => {
      if (!address) throw new Error('Connect a wallet before checking its registration.');
      return readController(address, controllerIds);
    },
    retry: false,
  });

  let status: WalletStatus;
  if (injectedWallet === false) status = { state: 'no_wallet' };
  else if (injectedWallet === undefined || !account.isConnected || !address) status = { state: 'disconnected' };
  else if (account.chainId !== sepolia.id) status = { state: 'wrong_network', address, chainId: account.chainId };
  else if (!registry.data || registry.isError) status = { state: 'not_registered', address };
  else status = { state: registry.data.balance < minimumBalance ? 'no_gas' : 'ready', address, ...registry.data };

  return {
    ...status,
    isChecking: injectedWallet === undefined || account.isReconnecting || (canInspect && registry.isPending),
    checkError: canInspect && registry.isError ? new Error('Sepolia registration or balance could not be checked.') : null,
    isConnecting,
    isSwitching,
    async connect() {
      const connector = connectors.find(({ id }) => id === 'injected');
      if (!injectedWallet || !connector) throw new Error('No injected wallet is available.');
      await connectAsync({ connector });
    },
    async switchToSepolia() {
      await switchChainAsync({ chainId: sepolia.id });
    },
    async refresh() {
      if (canInspect) await registry.refetch();
    },
  };
}
