'use server'

import { refresh } from 'next/cache'
import { cookies } from 'next/headers'

import { isSupportedCurrency } from '@/lib/currency'
import { CURRENCY_COOKIE_NAME } from '@/lib/currency-preference'

export async function setCurrencyPreference(value: string): Promise<void> {
  if (!isSupportedCurrency(value)) return

  (await cookies()).set(CURRENCY_COOKIE_NAME, value, {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 365,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  })
  refresh()
}
