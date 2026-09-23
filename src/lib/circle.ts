import { cache } from 'react'

import { createClient } from '@/lib/supabase/server'

export const CIRCLE_PAGE_SIZE = 20

export type CircleTopic = {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string | null
}

type CircleProfile = { id: string; display_name: string | null; username: string | null }

type CircleDiscussionRow = {
  id: string
  topic_id: string | null
  author_id: string | null
  title: string
  pinned: boolean
  locked: boolean
  view_count: number
  created_at: string
}

export type CircleDiscussionSummary = CircleDiscussionRow & {
  topic: Pick<CircleTopic, 'id' | 'name' | 'slug'> | null
  authorName: string
}

const topicProjection = 'id,name,slug,description,icon,sort_order'
const discussionProjection = 'id,topic_id,author_id,title,pinned,locked,view_count,created_at'

export function parseCirclePage(value: string | string[] | undefined) {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return 1
  const page = Number(value)
  return Number.isSafeInteger(page) && page >= 1 && page <= 10_000 ? page : 1
}

export function circleAuthorName(profile: CircleProfile | null | undefined) {
  return profile?.display_name?.trim() || (profile?.username?.trim() ? `@${profile.username.trim()}` : 'Member')
}

export async function getActiveCircleTopics() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('evo_circle_topics')
    .select(topicProjection)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })
    .order('id', { ascending: true })
    .limit(200)

  return { topics: (data ?? []) as CircleTopic[], hasError: Boolean(error) }
}

export const getActiveCircleTopic = cache(async (slug: string): Promise<CircleTopic | null> => {
  if (!slug.trim()) return null
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('evo_circle_topics')
    .select(topicProjection)
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle()

  return error ? null : data as CircleTopic | null
})

export async function getPublicCircleDiscussions(page: number, topicId?: string) {
  const supabase = await createClient()
  const from = (page - 1) * CIRCLE_PAGE_SIZE
  let query = supabase
    .from('evo_circle_discussions')
    .select(discussionProjection)
    .eq('status', 'published')
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(from, from + CIRCLE_PAGE_SIZE)
  if (topicId) query = query.eq('topic_id', topicId)

  const { data, error } = await query
  if (error) return { discussions: [] as CircleDiscussionSummary[], hasError: true, hasNextPage: false }

  const rows = (data ?? []) as CircleDiscussionRow[]
  const visibleRows = rows.slice(0, CIRCLE_PAGE_SIZE)
  const topicIds = [...new Set(visibleRows.flatMap((row) => row.topic_id ? [row.topic_id] : []))]
  const authorIds = [...new Set(visibleRows.flatMap((row) => row.author_id ? [row.author_id] : []))]
  const [topicsResult, profilesResult] = await Promise.all([
    topicIds.length
      ? supabase.from('evo_circle_topics').select('id,name,slug').eq('is_active', true).in('id', topicIds)
      : Promise.resolve({ data: [], error: null }),
    authorIds.length
      ? supabase.from('profiles').select('id,display_name,username').in('id', authorIds)
      : Promise.resolve({ data: [], error: null }),
  ])
  const topics = new Map((topicsResult.data ?? []).map((topic) => [topic.id, topic]))
  const profiles = new Map(((profilesResult.data ?? []) as CircleProfile[]).map((profile) => [profile.id, profile]))

  return {
    discussions: visibleRows.map((row) => ({
      ...row,
      topic: row.topic_id ? topics.get(row.topic_id) ?? null : null,
      authorName: circleAuthorName(row.author_id ? profiles.get(row.author_id) : null),
    })) as CircleDiscussionSummary[],
    hasError: Boolean(topicsResult.error),
    hasNextPage: rows.length > CIRCLE_PAGE_SIZE,
  }
}

export async function getCircleStartHref() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  return data.user ? '/circle/new' : '/auth/login?next=%2Fcircle%2Fnew'
}
