import type { Metadata } from 'next'
import { SelectReceiptPane } from '@/components/citizen-workspace/Split'

export const metadata: Metadata = { title: 'Your receipts' }

/**
 * The receipts list lives in the citizen layout (CitizenWorkspace) so it survives opening a receipt.
 * This page is the laptop detail pane before a receipt is picked; phones show the list instead.
 */
export default function CitizenPage() {
  return <SelectReceiptPane />
}
