'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { IconArrow } from '@/components/ui/icons'
import { BreachDetailLoader } from '../../BreachDetail'

export function BreachPage() {
  const { id } = useParams<{ id: string }>()

  return (
    <div className="mx-auto flex max-w-[820px] flex-col gap-6">
      <Link href="/regulator" className="label no-print -ml-2 flex min-h-11 w-fit items-center gap-2 px-2 text-ink-2 hover:text-blue">
        <IconArrow size={14} className="rotate-180" /> All notices
      </Link>
      <BreachDetailLoader id={id} />
    </div>
  )
}
