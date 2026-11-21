import Link from 'next/link'
import { IconArrow } from '@/components/ui/icons'
import { OdoText } from './OdoText'

type Variant = 'dark' | 'light' | 'paper' | 'ghost-vault'

const V: Record<Variant, string> = {
  dark: 'bg-ink text-paper hover:bg-[#3a332c]',
  light: 'border border-line-strong text-ink hover:border-ink hover:bg-ink/[.06]',
  paper: 'bg-paper text-vault hover:bg-white',
  'ghost-vault': 'border border-vault-ink-2/60 text-vault-ink hover:border-vault-ink hover:bg-vault-ink/[.06]',
}

/**
 * Landing CTA: rounded r-md, colour-only hover (150 ms, .65,0,.2,1), odometer label. The dark variant keeps
 * Saksi's blue r-sm arrow tile; the paper variant (on vault) carries zaro's 6 px square bullet in blue.
 */
export function Cta({
  href,
  children,
  variant = 'dark',
  size = 'lg',
  className = '',
}: {
  href: string
  children: string
  variant?: Variant
  size?: 'md' | 'lg'
  className?: string
}) {
  const arrow = variant === 'dark' || variant === 'ghost-vault'
  const h = size === 'lg' ? 'h-12 text-[16px]' : 'h-10 text-[14px]'
  return (
    <Link
      href={href}
      className={`group inline-flex shrink-0 items-center gap-3 whitespace-nowrap rounded-md font-medium tracking-[0.01em] transition-[background-color,border-color,color] duration-150 ease-[cubic-bezier(.65,0,.2,1)] ${h} ${
        arrow ? 'pl-5 pr-1.5' : 'px-5'
      } ${V[variant]} ${className}`}
    >
      {variant === 'paper' ? <span aria-hidden="true" className="size-1.5 bg-blue" /> : null}
      <OdoText>{children}</OdoText>
      {arrow ? (
        <span
          aria-hidden="true"
          className={`flex aspect-square h-[calc(100%-12px)] items-center justify-center rounded-sm ${
            variant === 'dark' ? 'bg-blue text-white' : 'bg-ice text-vault'
          }`}
        >
          <IconArrow size={16} />
        </span>
      ) : null}
    </Link>
  )
}
