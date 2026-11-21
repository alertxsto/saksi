import type { Metadata } from 'next'
import { AutoOpenNewest } from './AutoOpenNewest'

export const metadata: Metadata = { title: 'Your receipts' }

/**
 * The receipts list lives in the citizen layout (CitizenWorkspace) so it survives opening a receipt.
 * This page is the laptop detail pane: it opens the newest receipt; phones show the list instead.
 */
export default function CitizenPage() {
  return <AutoOpenNewest />
}
