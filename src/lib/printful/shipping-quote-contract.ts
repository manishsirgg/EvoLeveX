// Pure request validation only. No HTTP calls, credentials, addresses persisted, or order writes.
// Legacy Printful shipping/rates API uses catalog variant_id (NOT synchronized variant ID).
export type QuoteCountry = 'IN' | 'US'
export type ShippingQuoteInput = {
  countryCode: QuoteCountry
  stateCode?: string
  postalCode?: string
  city?: string
  catalogVariantId: number
  quantity: number
  currency?: string
}
export type ShippingQuoteRequest = {
  recipient: { country_code: QuoteCountry; state_code?: string; zip?: string; city?: string }
  items: [{ variant_id: number; quantity: number }]
  currency?: string
}
export type QuoteValidation =
  | { ok: true; request: ShippingQuoteRequest }
  | { ok: false; reason: 'INVALID_COUNTRY' | 'STATE_REQUIRED' | 'INVALID_STATE' | 'INVALID_POSTAL' | 'INVALID_CITY' | 'INVALID_VARIANT' | 'INVALID_QUANTITY' | 'INVALID_CURRENCY' }

export function validateShippingQuoteInput(input: ShippingQuoteInput): QuoteValidation {
  if (input.countryCode !== 'IN' && input.countryCode !== 'US') return { ok: false, reason: 'INVALID_COUNTRY' }
  if (input.countryCode === 'US' && !input.stateCode) return { ok: false, reason: 'STATE_REQUIRED' }
  if (input.stateCode !== undefined && !/^[A-Z]{2}$/.test(input.stateCode)) return { ok: false, reason: 'INVALID_STATE' }
  if (input.postalCode !== undefined && (input.postalCode.length > 16 || !/^[a-zA-Z0-9 -]{3,16}$/.test(input.postalCode))) return { ok: false, reason: 'INVALID_POSTAL' }
  if (input.city !== undefined && (input.city.length > 100 || !/^[\p{L}\p{M} .'-]{2,100}$/u.test(input.city))) return { ok: false, reason: 'INVALID_CITY' }
  if (!Number.isSafeInteger(input.catalogVariantId) || input.catalogVariantId <= 0) return { ok: false, reason: 'INVALID_VARIANT' }
  if (!Number.isSafeInteger(input.quantity) || input.quantity < 1 || input.quantity > 10) return { ok: false, reason: 'INVALID_QUANTITY' }
  if (input.currency !== undefined && !/^[A-Z]{3}$/.test(input.currency)) return { ok: false, reason: 'INVALID_CURRENCY' }
  const recipient: ShippingQuoteRequest['recipient'] = { country_code: input.countryCode }
  if (input.stateCode) recipient.state_code = input.stateCode
  if (input.postalCode) recipient.zip = input.postalCode
  if (input.city) recipient.city = input.city
  const request: ShippingQuoteRequest = { recipient, items: [{ variant_id: input.catalogVariantId, quantity: input.quantity }] }
  if (input.currency) request.currency = input.currency
  return { ok: true, request }
}
