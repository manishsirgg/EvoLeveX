import {
  validateCanonicalRazorpayPayment,
} from './razorpay-webhook.ts'

type CanonicalPayment = Parameters<typeof validateCanonicalRazorpayPayment>[0]

type ExpectedPayment = {
  paymentId: string
  orderId: string
  amount: string
  currency: string
}

type Dependencies<Confirmation> = {
  verifyCheckoutSignature: () => boolean
  fetchPayment: (paymentId: string) => Promise<CanonicalPayment>
  confirmPayment: () => Promise<Confirmation>
  isRetryableFetchError: (error: unknown) => boolean
}

export type BrowserConfirmationResult<Confirmation> =
  | { outcome: 'confirmed'; confirmation: Confirmation }
  | { outcome: 'invalid_signature' }
  | { outcome: 'verification_unavailable' }
  | { outcome: 'incomplete' }
  | { outcome: 'provider_unavailable'; retryable: boolean }

/**
 * Keeps provider retrieval/validation immediately in front of the only callback
 * that may enter the atomic local confirmation transaction.
 */
export async function confirmCanonicalRazorpayPayment<Confirmation>(
  expected: ExpectedPayment,
  dependencies: Dependencies<Confirmation>,
): Promise<BrowserConfirmationResult<Confirmation>> {
  let signatureIsValid: boolean
  try {
    signatureIsValid = dependencies.verifyCheckoutSignature()
  } catch {
    return { outcome: 'verification_unavailable' }
  }
  if (!signatureIsValid) return { outcome: 'invalid_signature' }

  let canonical: CanonicalPayment
  try {
    canonical = await dependencies.fetchPayment(expected.paymentId)
  } catch (error) {
    return {
      outcome: 'provider_unavailable',
      retryable: dependencies.isRetryableFetchError(error),
    }
  }

  try {
    validateCanonicalRazorpayPayment(canonical, expected)
  } catch {
    return { outcome: 'incomplete' }
  }

  return {
    outcome: 'confirmed',
    confirmation: await dependencies.confirmPayment(),
  }
}
