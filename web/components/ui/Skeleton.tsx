export function Skeleton({ className = '' }: { className?: string }) {
  return <span aria-hidden="true" className={`skeleton block rounded-sm ${className}`} />
}

/** Placeholder shaped like a receipt card. */
export function ReceiptCardSkeleton() {
  return (
    <div className="flex gap-3 rounded-lg border border-line bg-card p-4" aria-hidden="true">
      <Skeleton className="h-11 w-11 shrink-0" />
      <div className="flex flex-1 flex-col gap-2 pt-1">
        <Skeleton className="h-3.5 w-2/3" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="mt-2 h-7 w-28" />
      </div>
    </div>
  )
}

/** Placeholder for the receipt detail screen. */
export function ReceiptDetailSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-label="Loading receipt">
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-72 w-full" />
      <Skeleton className="h-14 w-full" />
    </div>
  )
}

/** Placeholder for the profile screen. */
export function ProfileSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-label="Loading profile">
      <Skeleton className="h-10 w-2/3" />
      <Skeleton className="aspect-square w-full" />
      <Skeleton className="h-[52px] w-full" />
    </div>
  )
}
