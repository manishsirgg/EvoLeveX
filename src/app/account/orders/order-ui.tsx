import type { ReactNode } from 'react'

import { formatMoney, parseSupportedCurrency } from '@/lib/currency'

export function money(amount: number | string, currency: string) {
  const safeCurrency = parseSupportedCurrency(currency)
  return safeCurrency ? formatMoney(amount, safeCurrency) : `${currency} ${amount}`
}

export function dateTime(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.valueOf()) ? 'Unavailable' : new Intl.DateTimeFormat('en', {
    dateStyle: 'medium', timeStyle: 'short',
  }).format(date)
}

export function StatusBadge({ value }: { value: string }) {
  const normalized = value.replaceAll('_', ' ')
  const positive = ['paid', 'confirmed'].includes(value)
  const refund = value.includes('refund')
  return <span className={`inline-flex border px-2.5 py-1 text-xs font-semibold capitalize ${
    refund ? 'border-sky-300/30 bg-sky-300/[0.07] text-sky-200'
      : positive ? 'border-emerald-300/30 bg-emerald-300/[0.07] text-emerald-200'
        : 'border-amber-300/30 bg-amber-300/[0.07] text-amber-200'
  }`}>{normalized}</span>
}

export function Definition({ term, children, strong = false }: { term: string; children: ReactNode; strong?: boolean }) {
  return <div className="flex items-start justify-between gap-5 border-b border-white/10 py-3 last:border-0">
    <dt className="text-sm text-zinc-400">{term}</dt>
    <dd className={`text-right text-sm tabular-nums ${strong ? 'font-semibold text-white' : 'text-zinc-200'}`}>{children}</dd>
  </div>
}
