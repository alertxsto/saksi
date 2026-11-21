import type { ReactNode } from 'react'
import type { WalletView } from '@/components/ui/WalletGate'

export type ExtraState = { label: string; render: () => ReactNode; wallet?: WalletView }

/** Access log and breach states, filled in as those screens land. */
export const AGENCY_GALLERY_EXTRA: Record<string, ExtraState> = {}
