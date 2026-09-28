import { TestVaultOrderClient } from './test-vault-order-client'

import { getCurrencyPreference } from '@/lib/currency-preference'

export default async function TestVaultOrderPage() {
  const selectedCurrency = await getCurrencyPreference()

  return <TestVaultOrderClient selectedCurrency={selectedCurrency} />
}
