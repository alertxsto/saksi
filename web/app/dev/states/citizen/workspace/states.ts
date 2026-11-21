/** Laptop workspace gallery states (?s=…). Plain module so the server page can validate the param. */
export const WORKSPACE_STATES = {
  list: 'Receipts · nothing selected',
  checking: 'Receipts · phone checking in the background',
  detail: 'Receipt open · MATCH',
  verify: 'Receipt open · before verify',
  altered: 'ALTERED · banner + red row + comparison',
  deleted: 'DELETED · ghost card',
  empty: 'Receipts · empty',
  loading: 'Receipts · loading',
  error: 'Receipts · load error',
  onboarding: 'No profile · onboarding',
  profile: 'Profile · who opened your data',
  'profile-altered': 'Profile · one company altered a record',
  'profile-empty': 'Profile · no receipts yet',
  'profile-confirm': 'Profile · confirm delete',
} as const
export type WorkspaceState = keyof typeof WORKSPACE_STATES
