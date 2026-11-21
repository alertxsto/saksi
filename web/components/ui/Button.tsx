import Link from 'next/link'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { IconArrow, IconSpinner } from './icons'

type Variant = 'dark' | 'light' | 'blue' | 'ghost' | 'danger' | 'vault'
type Size = 'md' | 'lg' | 'sm'

const base =
  'group relative inline-flex rounded-md select-none items-stretch justify-between gap-0 text-left font-medium transition-[background-color,border-color,color,transform] duration-150 active:translate-y-px disabled:cursor-not-allowed disabled:border-line disabled:bg-paper-2 disabled:text-ink-3 disabled:hover:border-line disabled:hover:bg-paper-2'

const variants: Record<Variant, string> = {
  dark: 'bg-ink text-paper hover:bg-[#2c2722]',
  light: 'border border-line-strong bg-card text-ink hover:border-ink',
  blue: 'bg-blue text-white hover:bg-[#2121c9]',
  ghost: 'text-ink hover:bg-paper-2',
  danger: 'border border-bad text-bad bg-card hover:bg-bad-bg',
  vault: 'border border-vault-line bg-vault-2 text-vault-ink hover:border-dot-2',
}

const sizes: Record<Size, string> = {
  sm: 'min-h-11 text-[14px]',
  md: 'min-h-[52px] text-[15px]',
  lg: 'min-h-14 text-[16px]',
}

/** Blue arrow square on the right edge (base.org / zaro style). */
function ArrowBox({ variant, loading }: { variant: Variant; loading?: boolean }) {
  const box =
    variant === 'dark'
      ? 'bg-blue text-white'
      : variant === 'blue'
        ? 'bg-white/15 text-white'
        : variant === 'vault'
          ? 'bg-ice text-vault'
          : 'bg-ink text-paper'
  return (
    <span aria-hidden="true" className={`m-1 flex group-disabled:bg-line group-disabled:text-ink-3 w-11 shrink-0 items-center justify-center self-stretch rounded-sm ${box}`}>
      {loading ? <IconSpinner size={18} /> : <IconArrow size={18} className="transition-transform duration-200 group-hover:translate-x-0.5" />}
    </span>
  )
}

type Common = {
  variant?: Variant
  size?: Size
  arrow?: boolean
  loading?: boolean
  icon?: ReactNode
  full?: boolean
  className?: string
  children: ReactNode
}

function Inner({ variant = 'dark', arrow, loading, icon, children }: Common) {
  return (
    <>
      <span className={`flex flex-1 items-center gap-2.5 py-3 ${arrow ? 'pl-5 pr-3' : 'px-5 justify-center'}`}>
        {loading && !arrow ? <IconSpinner size={16} /> : icon}
        <span>{children}</span>
      </span>
      {arrow ? <ArrowBox variant={variant} loading={loading} /> : null}
    </>
  )
}

export function Button({
  variant = 'dark',
  size = 'md',
  arrow,
  loading,
  icon,
  full,
  className = '',
  children,
  ...rest
}: Common & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>) {
  return (
    <button
      type="button"
      aria-busy={loading || undefined}
      className={`${base} ${variants[variant]} ${sizes[size]} ${full ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      <Inner variant={variant} arrow={arrow} loading={loading} icon={icon}>
        {children}
      </Inner>
    </button>
  )
}

export function ButtonLink({
  href,
  variant = 'dark',
  size = 'md',
  arrow,
  icon,
  full,
  className = '',
  children,
  external,
}: Common & { href: string; external?: boolean }) {
  const cls = `${base} ${variants[variant]} ${sizes[size]} ${full ? 'w-full' : ''} ${className}`
  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={cls}>
        <Inner variant={variant} arrow={arrow} icon={icon}>
          {children}
        </Inner>
      </a>
    )
  }
  return (
    <Link href={href} className={cls}>
      <Inner variant={variant} arrow={arrow} icon={icon}>
        {children}
      </Inner>
    </Link>
  )
}
