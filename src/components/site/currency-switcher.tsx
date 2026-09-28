'use client'

import { useTransition } from 'react'

import { setCurrencyPreference } from '@/app/(site)/currency-actions'
import { SUPPORTED_CURRENCIES, type SupportedCurrency } from '@/lib/currency'

export function CurrencySwitcher({ currency, mobile = false }: { currency: SupportedCurrency; mobile?: boolean }) {
  const [pending, startTransition] = useTransition()

  return (
    <label className={mobile ? 'currency-switcher currency-switcher-mobile' : 'currency-switcher'}>
      <span>{mobile ? 'Display currency' : 'Currency'}</span>
      <select
        aria-label="Display currency"
        value={currency}
        disabled={pending}
        onChange={(event) => startTransition(() => setCurrencyPreference(event.target.value))}
      >
        {SUPPORTED_CURRENCIES.map((option) => (
          <option key={option.code} value={option.code}>{option.code} — {option.name}</option>
        ))}
      </select>
    </label>
  )
}
