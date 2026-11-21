'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { custom } from 'viem'
import { sepolia } from 'viem/chains'
import { createConfig, WagmiProvider } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { wagmiConfig } from './wagmi'

// Without NEXT_PUBLIC_RPC_* (for example a build with no env) wagmiConfig is undefined. The hooks still
// need a provider, so use a config whose transport refuses every request: screens then show their
// "not configured" / error states instead of crashing, and nothing falls back to a default public RPC.
const unconfigured = createConfig({
  chains: [sepolia],
  connectors: [injected()],
  transports: {
    [sepolia.id]: custom({
      request: () => Promise.reject(new Error('The Sepolia RPC is not configured on this deployment.')),
    }),
  },
  ssr: true,
  multiInjectedProviderDiscovery: false,
})

/** Wallet + data-fetching context. Mounted once in the root layout around the app. */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } },
      }),
  )
  return (
    <WagmiProvider config={wagmiConfig ?? unconfigured}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  )
}
