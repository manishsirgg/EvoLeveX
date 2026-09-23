import { circleUuidPattern } from './circle-validation'

export const CIRCLE_REPORT_DETAILS_MAX = 1000

export const CIRCLE_REPORT_REASONS = [
  { value: 'spam', label: 'Spam' },
  { value: 'harassment', label: 'Harassment' },
  { value: 'hate', label: 'Hate or hateful content' },
  { value: 'misinformation', label: 'Misinformation' },
  { value: 'copyright', label: 'Copyright violation' },
  { value: 'sexual_content', label: 'Sexual content' },
  { value: 'violence', label: 'Violence' },
  { value: 'other', label: 'Other' },
] as const

export type CircleReportTarget = 'discussion' | 'reply'
export type CircleReportReason = (typeof CIRCLE_REPORT_REASONS)[number]['value']

type ValidReport = {
  targetType: CircleReportTarget
  targetId: string
  reason: CircleReportReason
  details: string | null
}

export function validateCircleReport(value: unknown): { data: ValidReport } | { error: string } {
  if (!value || typeof value !== 'object') return { error: 'Invalid request.' }
  const input = value as Record<string, unknown>
  if (input.targetType !== 'discussion' && input.targetType !== 'reply') return { error: 'A valid report target is required.' }
  if (typeof input.targetId !== 'string' || !circleUuidPattern.test(input.targetId)) return { error: 'A valid report target is required.' }
  if (typeof input.reason !== 'string' || !CIRCLE_REPORT_REASONS.some(({ value: reason }) => reason === input.reason)) return { error: 'Select a valid reason.' }
  if (input.details !== undefined && input.details !== null && typeof input.details !== 'string') return { error: 'Report details must be text.' }
  const rawDetails = typeof input.details === 'string' ? input.details : ''
  if (rawDetails.length > CIRCLE_REPORT_DETAILS_MAX) return { error: `Details must be ${CIRCLE_REPORT_DETAILS_MAX.toLocaleString('en')} characters or fewer.` }
  const details = rawDetails.trim() || null
  if (input.reason === 'other' && !details) return { error: 'Add details when selecting Other.' }
  return { data: { targetType: input.targetType, targetId: input.targetId, reason: input.reason as CircleReportReason, details } }
}
