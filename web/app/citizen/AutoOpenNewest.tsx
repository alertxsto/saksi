'use client'

import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { SelectReceiptPane } from '@/components/citizen-workspace/Split'
import { receiptsQuery } from './CitizenHome'

/**
 * Laptop pane on /citizen: opens the newest receipt so the right half is never empty. The split decides
 * phone vs laptop with a container query, so this only acts when the pane is actually on screen. Only once
 * per page load, so closing the pane leaves it closed.
 */
let opened = false

export function AutoOpenNewest() {
  const router = useRouter()
  const q = useQuery(receiptsQuery)
  const newest = q.data?.receipts[0]?.eventId
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (opened || !newest || !ref.current?.getClientRects().length) return
    opened = true
    router.replace(`/citizen/receipt/${encodeURIComponent(newest)}`, { scroll: false })
  }, [newest, router])
  return (
    <div ref={ref} className="flex flex-1 flex-col">
      <SelectReceiptPane count={q.data ? q.data.receipts.length : undefined} />
    </div>
  )
}
