import * as React from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

/* ═══════════════════════════════════════════════════════════════════════════
   UI PRIMITIVES
   Small, accessible building blocks. No component library — this is a
   consumer product with its own voice, and a handful of primitives is easier
   for a future developer to read than a wrapper around someone else's.
   ═══════════════════════════════════════════════════════════════════════════ */

// ── Button ──────────────────────────────────────────────────────────────────

const buttonVariants = {
  primary:
    'bg-terracotta-500 text-white hover:bg-terracotta-600 active:bg-terracotta-700 shadow-sm',
  secondary:
    'bg-ink-900 text-white hover:bg-ink-800 active:bg-ink-700 shadow-sm',
  outline:
    'border border-ink-300 bg-white text-ink-900 hover:bg-ink-50 hover:border-ink-400 active:bg-ink-100',
  ghost: 'text-ink-700 hover:bg-ink-100 hover:text-ink-900 active:bg-ink-200',
  quiet: 'bg-sand-200 text-ink-800 hover:bg-sand-300 active:bg-sand-400',
  danger: 'bg-berry-500 text-white hover:bg-berry-700 active:bg-berry-700 shadow-sm',
} as const

const buttonSizes = {
  sm: 'h-9 px-3.5 text-sm gap-1.5 rounded-lg',
  md: 'h-11 px-5 text-[0.95rem] gap-2 rounded-xl',
  lg: 'h-13 px-7 text-base gap-2.5 rounded-xl',
  icon: 'h-10 w-10 rounded-xl',
} as const

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof buttonVariants
  size?: keyof typeof buttonSizes
  loading?: boolean
  fullWidth?: boolean
}

export function Button({
  className,
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center font-medium transition-all duration-150',
        'disabled:pointer-events-none disabled:opacity-50',
        // 44px minimum touch target on mobile for everything but icon buttons
        size !== 'icon' && 'min-h-[44px] sm:min-h-0',
        buttonVariants[variant],
        buttonSizes[size],
        fullWidth && 'w-full',
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  )
}

export interface LinkButtonProps extends React.ComponentProps<typeof Link> {
  variant?: keyof typeof buttonVariants
  size?: keyof typeof buttonSizes
  fullWidth?: boolean
}

export function LinkButton({
  className,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  ...props
}: LinkButtonProps) {
  return (
    <Link
      className={cn(
        'inline-flex items-center justify-center font-medium transition-all duration-150',
        size !== 'icon' && 'min-h-[44px] sm:min-h-0',
        buttonVariants[variant],
        buttonSizes[size],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    />
  )
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn('animate-spin', className)}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M4 12a8 8 0 0 1 8-8v3a5 5 0 0 0-5 5H4z"
      />
    </svg>
  )
}

// ── Card ────────────────────────────────────────────────────────────────────

export function Card({
  className,
  interactive = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-card border border-ink-200/70 bg-white shadow-card',
        interactive &&
          'transition-all duration-200 hover:shadow-card-hover hover:border-ink-300 focus-within:shadow-card-hover',
        className,
      )}
      {...props}
    />
  )
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5', className)} {...props} />
}

// ── Badge ───────────────────────────────────────────────────────────────────

const badgeVariants = {
  neutral: 'bg-ink-100 text-ink-700',
  terracotta: 'bg-terracotta-100 text-terracotta-700',
  ocean: 'bg-ocean-100 text-ocean-700',
  moss: 'bg-moss-100 text-moss-700',
  gold: 'bg-gold-100 text-gold-700',
  berry: 'bg-berry-100 text-berry-700',
  outline: 'border border-ink-300 text-ink-700',
  dark: 'bg-ink-900 text-white',
} as const

export function Badge({
  className,
  variant = 'neutral',
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: keyof typeof badgeVariants }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap',
        badgeVariants[variant],
        className,
      )}
      {...props}
    />
  )
}

// ── Form fields ─────────────────────────────────────────────────────────────

export interface FieldProps {
  label: string
  htmlFor: string
  hint?: string
  error?: string | null
  required?: boolean
  children: React.ReactNode
  className?: string
}

export function Field({ label, htmlFor, hint, error, required, children, className }: FieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {/*
        The required asterisk lives OUTSIDE the <label> element. Inside it, it
        would become part of the field's accessible name ("Password *"), which
        is both worse to hear and harder to target. The input's own `required`
        attribute is what actually announces the requirement.
      */}
      <div className="flex items-baseline gap-1">
        <label htmlFor={htmlFor} className="block text-sm font-medium text-ink-800">
          {label}
        </label>
        {required && (
          <span className="text-sm text-terracotta-500" aria-hidden="true">
            *
          </span>
        )}
      </div>
      {hint && (
        <p id={`${htmlFor}-hint`} className="text-xs text-ink-500">
          {hint}
        </p>
      )}
      {children}
      {error && (
        <p id={`${htmlFor}-error`} role="alert" className="text-xs font-medium text-berry-500">
          {error}
        </p>
      )}
    </div>
  )
}

export const inputClasses =
  'w-full rounded-xl border border-ink-300 bg-white px-3.5 py-2.5 text-ink-900 placeholder:text-ink-400 ' +
  'transition-colors focus:border-ocean-500 focus:outline-none focus:ring-2 focus:ring-ocean-500/20 ' +
  'disabled:bg-ink-50 disabled:text-ink-500 aria-[invalid=true]:border-berry-500'

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputClasses, className)} {...props} />
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(inputClasses, 'min-h-[110px] resize-y', className)} {...props} />
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(inputClasses, 'appearance-none bg-no-repeat pr-10', className)}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236B7583' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")",
        backgroundPosition: 'right 0.75rem center',
        backgroundSize: '1.1rem',
      }}
      {...props}
    />
  )
}

// ── Feedback ────────────────────────────────────────────────────────────────

export function Alert({
  tone = 'info',
  title,
  children,
  className,
}: {
  tone?: 'info' | 'success' | 'warning' | 'error'
  title?: string
  children?: React.ReactNode
  className?: string
}) {
  const tones = {
    info: 'bg-ocean-50 border-ocean-200 text-ocean-800',
    success: 'bg-moss-100 border-moss-300 text-moss-700',
    warning: 'bg-gold-100 border-gold-300 text-gold-700',
    error: 'bg-berry-100 border-berry-500/30 text-berry-700',
  } as const
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn('rounded-xl border px-4 py-3 text-sm', tones[tone], className)}
    >
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className={cn(title && 'mt-1', 'text-pretty')}>{children}</div>}
    </div>
  )
}

export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: string
  description?: React.ReactNode
  action?: React.ReactNode
  icon?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-card border border-dashed border-ink-300 bg-white/60 px-6 py-14 text-center',
        className,
      )}
    >
      {icon && <div className="mb-4 text-ink-400">{icon}</div>}
      <h3 className="text-lg font-semibold text-ink-900">{title}</h3>
      {description && (
        <div className="mt-2 max-w-md text-sm text-ink-600 text-pretty">{description}</div>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton rounded-lg', className)} aria-hidden="true" />
}

// ── Layout helpers ──────────────────────────────────────────────────────────

export function SectionHeading({
  title,
  description,
  action,
  className,
  as: Tag = 'h2',
}: {
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
  as?: 'h1' | 'h2' | 'h3'
}) {
  return (
    <div className={cn('flex items-end justify-between gap-4', className)}>
      <div className="min-w-0">
        <Tag className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</Tag>
        {description && <p className="mt-1 text-sm text-ink-600 text-pretty">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

export function Divider({ className }: { className?: string }) {
  return <hr className={cn('border-ink-200', className)} />
}
