import { cn } from '@/lib/utils'
import { brand } from '@/config/brand'

/**
 * The logo mark. A compass rose drawn as a path so it scales cleanly and
 * needs no image request. Change it here and it changes everywhere.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('h-7 w-7', className)} aria-hidden="true" fill="none">
      <circle cx="16" cy="16" r="15" stroke="currentColor" strokeWidth="1.5" opacity="0.28" />
      <path
        d="M16 3.5 18.7 13.3 28.5 16 18.7 18.7 16 28.5 13.3 18.7 3.5 16 13.3 13.3Z"
        fill="currentColor"
      />
    </svg>
  )
}

export function Logo({
  className,
  showWordmark = true,
  size = 'md',
}: {
  className?: string
  showWordmark?: boolean
  size?: 'sm' | 'md' | 'lg'
}) {
  const sizes = {
    sm: { mark: 'h-5 w-5', text: 'text-lg' },
    md: { mark: 'h-7 w-7', text: 'text-[1.4rem]' },
    lg: { mark: 'h-9 w-9', text: 'text-3xl' },
  } as const
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark className={cn(sizes[size].mark, 'text-terracotta-500')} />
      {showWordmark && (
        <span
          className={cn('font-semibold tracking-tight', sizes[size].text)}
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {brand.name}
        </span>
      )}
    </span>
  )
}
