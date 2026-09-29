export type RetryRefundState = { status: 'idle' | 'success' | 'error'; message: string }

export const initialRetryRefundState: RetryRefundState = { status: 'idle', message: '' }
