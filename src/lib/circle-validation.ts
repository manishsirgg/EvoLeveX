export const CIRCLE_DISCUSSION_LIMITS = { titleMin: 5, titleMax: 160, bodyMin: 20, bodyMax: 10_000 } as const

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
