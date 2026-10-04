export type RetryRefundState = { status: 'idle' | 'success' | 'error'; message: string }
export type RetryCapturedPaymentState = RetryRefundState

export const initialRetryRefundState: RetryRefundState = { status: 'idle', message: '' }
export const initialRetryCapturedPaymentState: RetryCapturedPaymentState = { status: 'idle', message: '' }
