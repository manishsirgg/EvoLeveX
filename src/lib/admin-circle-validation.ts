export const CIRCLE_TOPIC_LIMITS = {
  name: 120,
  slug: 160,
  description: 2_000,
  icon: 32,
} as const

export type CircleTopicActionState = {
  error?: string
  fields?: Record<string, string>
  isActive?: boolean
}

export const initialCircleTopicState: CircleTopicActionState = {}

export function normalizeCircleTopicSlug(value: string) {
  return value
    .normalize('NFKD')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
