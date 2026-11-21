/**
 * Typed public config. Every value comes from NEXT_PUBLIC_* (inlined at build time, so each variable is read
 * by its literal name). Dynamic text in the UI must come from here, not be typed in.
 */
const isAddr = (v: string | undefined): v is string => !!v && /^0x[0-9a-fA-F]{40}$/.test(v)
const clean = (v: string | undefined) => v?.trim().replace(/\/+$/, '')

export const SITE_URL = clean(process.env.NEXT_PUBLIC_SITE_URL) || 'http://localhost:3401'
export const CHAIN_NAME = process.env.NEXT_PUBLIC_CHAIN_NAME?.trim() || 'Sepolia'
export const EXPLORER_URL = clean(process.env.NEXT_PUBLIC_EXPLORER_URL) || 'https://sepolia.etherscan.io'

/** Block the contracts were deployed at; undefined until set. Shown as a formatted number. */
const deploy = Number(process.env.NEXT_PUBLIC_DEPLOY_BLOCK)
export const DEPLOY_BLOCK = Number.isInteger(deploy) && deploy > 0 ? deploy.toLocaleString('en-US') : undefined

export const CONTRACTS = {
  ControllerRegistry: isAddr(process.env.NEXT_PUBLIC_REGISTRY_ADDRESS) ? process.env.NEXT_PUBLIC_REGISTRY_ADDRESS : undefined,
  AccessJournal: isAddr(process.env.NEXT_PUBLIC_JOURNAL_ADDRESS) ? process.env.NEXT_PUBLIC_JOURNAL_ADDRESS : undefined,
  BreachNotice: isAddr(process.env.NEXT_PUBLIC_BREACH_ADDRESS) ? process.env.NEXT_PUBLIC_BREACH_ADDRESS : undefined,
} as const

export const explorerTx = (hash: string) => `${EXPLORER_URL}/tx/${hash}`
export const explorerAddress = (addr: string) => `${EXPLORER_URL}/address/${addr}`
