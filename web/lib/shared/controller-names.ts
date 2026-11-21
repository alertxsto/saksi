import { keccak256, toBytes, type Hex } from 'viem';

/**
 * Display names for the first three controllers. Their on-chain ControllerRegistered names ("Demo One", …) are
 * immutable, but the chain only binds the controller id and wallet; the name is display-only (receipts are compared
 * by controllerId). So the app shows these fictional names everywhere instead.
 */
const RENAMED: Record<string, string> = {
  'demo-one': 'Bank Kredit Contoh (fiktif)',
  'demo-two': 'Asuransi Contoh (fiktif)',
  'demo-spare': 'Fintech Contoh (fiktif)',
};

const BY_ID = new Map<string, string>(
  Object.entries(RENAMED).map(([slug, name]) => [keccak256(toBytes(`ctrl:${slug}`)).toLowerCase(), name]),
);

/** The name to show for a controller: the rename when there is one, else the registered name. */
export function controllerDisplayName(controllerId: Hex | string, registeredName: string): string;
export function controllerDisplayName(controllerId: Hex | string, registeredName: string | undefined): string | undefined;
export function controllerDisplayName(controllerId: Hex | string, registeredName: string | undefined) {
  return BY_ID.get(controllerId.toLowerCase()) ?? registeredName;
}

/** Slugs and new names, for the database migration and tests. */
export const RENAMED_CONTROLLERS = RENAMED;
