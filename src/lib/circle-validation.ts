export const CIRCLE_DISCUSSION_LIMITS = { titleMin: 5, titleMax: 160, bodyMin: 20, bodyMax: 10_000 } as const

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
