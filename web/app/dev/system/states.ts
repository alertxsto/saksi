export const SYSTEM_STATES = ['404', 'receipt', 'proof', 'error', 'checking', 'offline'] as const
export type SystemState = (typeof SYSTEM_STATES)[number]
