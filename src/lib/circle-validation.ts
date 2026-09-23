export const CIRCLE_DISCUSSION_LIMITS = { titleMin: 5, titleMax: 160, bodyMin: 20, bodyMax: 10_000 } as const
export const CIRCLE_REPLY_LIMITS = { bodyMin: 2, bodyMax: 5_000 } as const

export type CreateReplyState = {
  error?: string
  success?: string
  fieldError?: string
}

export const initialCreateReplyState: CreateReplyState = {}

export const circleUuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type CreateDiscussionState = {
  error?: string
  fieldErrors?: Partial<Record<'topic' | 'title' | 'body', string>>
  fields?: { topic: string; title: string; body: string }
}

export const initialCreateDiscussionState: CreateDiscussionState = {}

export function normalizeDiscussionSlug(value: string) {
  return value
    .normalize('NFKD')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
    .replace(/-+$/g, '')
}
