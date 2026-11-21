'use client'

import type { ReactNode } from 'react'
import { OdoText } from '@/components/landing/OdoText'
import { IconArrow, IconSpinner } from '@/components/ui/icons'

type Variant = 'dark' | 'light' | 'vault'

// Exactly the landing Cta classes (components/landing/Cta.tsx) so app actions and landing CTAs are one family.
const V: Record<Variant, string> = {
  dark: 'bg-ink text-paper hover:bg-[#3a332c]',
  light: 'border border-line-strong text-ink hover:border-ink hover:bg-ink/[.06]',
  vault: 'border border-vault-ink-2/60 text-vault-ink hover:border-vault-ink hover:bg-vault-ink/[.06]',
}

/**
 * The landing `Cta` as a <button> for app actions (Verify, Keep as evidence, Copy code…): r-md, h-12 / h-10,
 * colour-only hover 150 ms (.65,0,.2,1), odometer label, blue arrow tile on the primary action. `loading`
 * swaps the arrow (or the leading icon) for a spinner.
 */
export function Act({
  children,
  onClick,
  variant = 'dark',
  size = 'lg',
  icon,
  arrow = variant === 'dark',
  loading = false,
  disabled = false,
  full = false,
  className = '',
}: {
  children: string
  onClick: () => void
  variant?: Variant
  size?: 'md' | 'lg'
  icon?: ReactNode
  arrow?: boolean
  loading?: boolean
  disabled?: boolean
  full?: boolean
  className?: string
}) {
  const h = size === 'lg' ? 'h-12 text-[16px]' : 'h-10 text-[14px]'
  const tile = variant === 'vault' ? 'bg-ice text-vault' : 'bg-blue text-white'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-busy={loading || undefined}
      className={`group inline-flex shrink-0 items-center gap-3 whitespace-nowrap rounded-md font-medium tracking-[0.01em] transition-[background-color,border-color,color] duration-150 ease-[cubic-bezier(.65,0,.2,1)] disabled:cursor-not-allowed disabled:opacity-45 ${h} ${
        arrow ? 'pl-5 pr-1.5' : 'px-5'
      } ${full ? (arrow ? 'w-full justify-between' : 'w-full justify-center') : ''} ${V[variant]} ${className}`}
    >
      <span className="flex min-w-0 items-center gap-2.5">
        {loading && !arrow ? <IconSpinner size={16} /> : icon}
        <OdoText>{children}</OdoText>
      </span>
      {arrow ? (
        <span aria-hidden="true" className={`flex aspect-square h-[calc(100%-12px)] items-center justify-center rounded-sm ${tile}`}>
          {loading ? <IconSpinner size={16} /> : <IconArrow size={16} />}
        </span>
      ) : null}
    </button>
  )
}
