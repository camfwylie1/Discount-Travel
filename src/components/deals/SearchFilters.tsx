'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Badge, Button, Input, Select } from '@/components/ui'
import { cn } from '@/lib/utils'

export interface FilterOptions {
  airports: { iata: string; city: string; count: number }[]
  countries: { code: string; name: string; count: number }[]
  tripTypes: { value: string; label: string }[]
  tags: { slug: string; label: string }[]
  providers: { slug: string; name: string }[]
}

const DURATIONS = [
  { value: 'weekend', label: 'Weekend' },
  { value: '4-6', label: '4–6 nights' },
  { value: '7', label: '1 week' },
  { value: '8-10', label: '8–10' },
  { value: '11-14', label: '11–14' },
  { value: '15-21', label: '15–21' },
  { value: '22-30', label: '22–30' },
]

const SORTS = [
  { value: 'match', label: 'Best match for you' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
  { value: 'date', label: 'Departing soonest' },
  { value: 'value', label: 'Best value' },
  { value: 'discount', label: 'Biggest discount' },
  { value: 'newest', label: 'Recently added' },
]

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * SEARCH FILTERS
 *
 * All state lives in the URL, so a filtered search is shareable, bookmarkable
 * and survives a refresh — and the server can render the results.
 */
export function SearchFilters({
  options,
  appliedCount,
}: {
  options: FilterOptions
  appliedCount: number
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(params.get('q') ?? '')

  const current = (key: string) => params.get(key) ?? ''
  const currentList = (key: string) => params.getAll(key)

  function update(changes: Record<string, string | string[] | null>) {
    const next = new URLSearchParams(params.toString())
    for (const [key, value] of Object.entries(changes)) {
      next.delete(key)
      if (value === null || value === '') continue
      if (Array.isArray(value)) {
        for (const v of value) next.append(key, v)
      } else {
        next.set(key, value)
      }
    }
    next.delete('page')
    startTransition(() => router.push(`${pathname}?${next.toString()}`, { scroll: false }))
  }

  function toggleInList(key: string, value: string) {
    const list = currentList(key)
    update({ [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value] })
  }

  function clearAll() {
    startTransition(() => router.push(pathname))
    setQuery('')
  }

  return (
    <div className="space-y-4">
      {/* Search bar + sort */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <form
          className="relative flex-1"
          onSubmit={(e) => {
            e.preventDefault()
            update({ q: query.trim() || null })
          }}
        >
          <label htmlFor="search-q" className="sr-only">
            Search trips
          </label>
          <svg
            viewBox="0 0 24 24"
            className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-400"
            fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
          </svg>
          <Input
            id="search-q"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Try “hiking Italy” or “beach under $1500”"
            className="pl-11"
            enterKeyHint="search"
          />
        </form>

        <div className="flex gap-2">
          <label className="sr-only" htmlFor="sort">Sort results</label>
          <Select
            id="sort"
            value={current('sort') || 'match'}
            onChange={(e) => update({ sort: e.target.value })}
            className="sm:w-52"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </Select>
          <Button
            variant="outline"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="filter-panel"
            className="shrink-0"
          >
            Filters
            {appliedCount > 0 && (
              <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-terracotta-500 px-1 text-[0.65rem] font-semibold text-white">
                {appliedCount}
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* Quick chips */}
      <div className="hide-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {DURATIONS.slice(0, 5).map((d) => (
          <Chip
            key={d.value}
            active={current('durationBucket') === d.value}
            onClick={() => update({ durationBucket: current('durationBucket') === d.value ? null : d.value })}
          >
            {d.label}
          </Chip>
        ))}
        <Chip
          active={current('airfareIncluded') === 'true'}
          onClick={() => update({ airfareIncluded: current('airfareIncluded') === 'true' ? null : 'true' })}
        >
          Flights included
        </Chip>
        <Chip
          active={current('soloFriendly') === 'true'}
          onClick={() => update({ soloFriendly: current('soloFriendly') === 'true' ? null : 'true' })}
        >
          Solo friendly
        </Chip>
        <Chip
          active={current('maxPrice') === '150000'}
          onClick={() => update({ maxPrice: current('maxPrice') === '150000' ? null : '150000' })}
        >
          Under $1,500
        </Chip>
        {appliedCount > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="shrink-0 rounded-full px-3 py-2 text-sm text-ink-500 underline underline-offset-4 hover:text-ink-800"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Full panel */}
      {open && (
        <div id="filter-panel" className="rounded-card border border-ink-200 bg-white p-5">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <Group label="Price per person">
              <div className="flex items-center gap-2">
                <Input
                  type="number" inputMode="numeric" placeholder="Min $" min={0} step={100}
                  defaultValue={current('minPrice') ? Number(current('minPrice')) / 100 : ''}
                  onBlur={(e) => update({ minPrice: e.target.value ? String(Number(e.target.value) * 100) : null })}
                  aria-label="Minimum price"
                />
                <span className="text-ink-400">–</span>
                <Input
                  type="number" inputMode="numeric" placeholder="Max $" min={0} step={100}
                  defaultValue={current('maxPrice') ? Number(current('maxPrice')) / 100 : ''}
                  onBlur={(e) => update({ maxPrice: e.target.value ? String(Number(e.target.value) * 100) : null })}
                  aria-label="Maximum price"
                />
              </div>
            </Group>

            <Group label="Departure airport">
              <div className="flex flex-wrap gap-1.5">
                {options.airports.slice(0, 10).map((a) => (
                  <Chip
                    key={a.iata}
                    small
                    active={currentList('airports').includes(a.iata)}
                    onClick={() => toggleInList('airports', a.iata)}
                  >
                    {a.iata} <span className="text-ink-400">({a.count})</span>
                  </Chip>
                ))}
              </div>
            </Group>

            <Group label="Trip length">
              <div className="flex flex-wrap gap-1.5">
                {DURATIONS.map((d) => (
                  <Chip
                    key={d.value}
                    small
                    active={current('durationBucket') === d.value}
                    onClick={() => update({ durationBucket: current('durationBucket') === d.value ? null : d.value })}
                  >
                    {d.label}
                  </Chip>
                ))}
              </div>
            </Group>

            <Group label="Destination">
              <div className="flex flex-wrap gap-1.5">
                {options.countries.slice(0, 14).map((c) => (
                  <Chip
                    key={c.code}
                    small
                    active={currentList('countries').includes(c.code)}
                    onClick={() => toggleInList('countries', c.code)}
                  >
                    {c.name}
                  </Chip>
                ))}
              </div>
            </Group>

            <Group label="Departure month">
              <div className="flex flex-wrap gap-1.5">
                {MONTH_LABELS.map((label, i) => (
                  <Chip
                    key={label}
                    small
                    active={currentList('months').includes(String(i + 1))}
                    onClick={() => toggleInList('months', String(i + 1))}
                  >
                    {label}
                  </Chip>
                ))}
              </div>
            </Group>

            <Group label="Trip type">
              <div className="flex flex-wrap gap-1.5">
                {options.tripTypes.map((t) => (
                  <Chip
                    key={t.value}
                    small
                    active={currentList('tripTypes').includes(t.value)}
                    onClick={() => toggleInList('tripTypes', t.value)}
                  >
                    {t.label}
                  </Chip>
                ))}
              </div>
            </Group>

            <Group label="Provider" className="lg:col-span-2">
              <div className="flex flex-wrap gap-1.5">
                {options.providers.map((p) => (
                  <Chip
                    key={p.slug}
                    small
                    active={currentList('providers').includes(p.slug)}
                    onClick={() => toggleInList('providers', p.slug)}
                  >
                    {p.name}
                  </Chip>
                ))}
              </div>
            </Group>
          </div>

          <div className="mt-5 flex justify-between gap-3 border-t border-ink-100 pt-4">
            <Button variant="ghost" onClick={clearAll} disabled={appliedCount === 0}>
              Clear all filters
            </Button>
            <Button onClick={() => setOpen(false)} loading={pending}>
              Show results
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function Group({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <fieldset className={className}>
      <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-500">
        {label}
      </legend>
      {children}
    </fieldset>
  )
}

function Chip({
  active,
  onClick,
  children,
  small = false,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  small?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'shrink-0 rounded-full border transition-colors',
        small ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2 text-sm min-h-[40px]',
        active
          ? 'border-ink-900 bg-ink-900 text-white'
          : 'border-ink-300 bg-white text-ink-700 hover:border-ink-500',
      )}
    >
      {children}
    </button>
  )
}

export function ActiveFilterSummary({ total }: { total: number }) {
  return <Badge variant="neutral">{total.toLocaleString('en-CA')} trips</Badge>
}
