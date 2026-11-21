import { CHAIN_NAME, EXPLORER_URL } from '@/lib/env'

/** Explorer host for labels ("sepolia.etherscan.io"), from NEXT_PUBLIC_EXPLORER_URL. Never typed in. */
export const EXPLORER_HOST = (() => {
  try {
    return new URL(EXPLORER_URL).host
  } catch {
    return EXPLORER_URL
  }
})()

/** "sepolia.etherscan.io · Sepolia": where an explorer link goes, for the caption under the button. */
export const EXPLORER_CAPTION = `${EXPLORER_HOST} · ${CHAIN_NAME}`
