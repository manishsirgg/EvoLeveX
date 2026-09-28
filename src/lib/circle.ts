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
  slug: string
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
const discussionProjection = 'id,topic_id,author_id,title,slug,pinned,locked,view_count,created_at'

export const CIRCLE_REPLY_LIMIT = 100

export type CircleReply = {
  id: string
  discussion_id: string
  parent_reply_id: string | null
  body: string
  created_at: string
  authorName: string
  likeCount: number
  liked: boolean
  reported: boolean
  own: boolean
  nested: boolean
}

export type CircleDiscussionDetail = CircleDiscussionSummary & { body: string }

const detailProjection = 'id,topic_id,author_id,title,slug,body,pinned,locked,view_count,created_at'

export const getPublicCircleDiscussion = cache(async (slug: string): Promise<CircleDiscussionDetail | null> => {
  if (!slug.trim()) return null
  const supabase = await createClient()
  const { data, error } = await supabase.from('evo_circle_discussions').select(detailProjection).eq('slug', slug).eq('status', 'published').maybeSingle()
  if (error || !data) return null
  const [topicResult, profileResult] = await Promise.all([
    data.topic_id ? supabase.from('evo_circle_topics').select('id,name,slug').eq('id', data.topic_id).eq('is_active', true).maybeSingle() : Promise.resolve({ data: null }),
    data.author_id ? supabase.from('profiles').select('id,display_name,username').eq('id', data.author_id).maybeSingle() : Promise.resolve({ data: null }),
  ])
  return { ...data, topic: topicResult.data ?? null, authorName: circleAuthorName(profileResult.data as CircleProfile | null) } as CircleDiscussionDetail
})

function safeCount(value: unknown) {
  const count = Number(value ?? 0)
  return Number.isSafeInteger(count) && count >= 0 ? count : 0
}

export async function getCircleDiscussionConversation(discussionId: string) {
  const supabase = await createClient()
  const [{ data: { user } }, repliesResult, discussionCountResult] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('evo_circle_replies').select('id,discussion_id,parent_reply_id,author_id,body,created_at').eq('discussion_id', discussionId).eq('status', 'published').order('created_at', { ascending: true }).order('id', { ascending: true }).limit(CIRCLE_REPLY_LIMIT + 1),
    supabase.rpc('get_evo_circle_discussion_like_count', { discussion_uuid: discussionId }),
  ])
  const rawReplies = (repliesResult.data ?? []).slice(0, CIRCLE_REPLY_LIMIT)
  const authorIds = [...new Set(rawReplies.flatMap((reply) => reply.author_id ? [reply.author_id] : []))]
  const replyIds = rawReplies.map((reply) => reply.id)
  const reportFilter = replyIds.length
    ? `discussion_id.eq.${discussionId},reply_id.in.(${replyIds.join(',')})`
    : `discussion_id.eq.${discussionId}`
  const [profilesResult, likesResult, reportsResult, ...countResults] = await Promise.all([
    authorIds.length ? supabase.from('profiles').select('id,display_name,username').in('id', authorIds) : Promise.resolve({ data: [], error: null }),
    user && replyIds.length ? supabase.from('evo_circle_reply_likes').select('reply_id').eq('user_id', user.id).in('reply_id', replyIds) : Promise.resolve({ data: [], error: null }),
    user ? supabase.from('content_reports').select('content_type,discussion_id,reply_id').eq('reporter_id', user.id).or(reportFilter) : Promise.resolve({ data: [], error: null }),
    ...replyIds.map((replyId) => supabase.rpc('get_evo_circle_reply_like_count', { reply_uuid: replyId })),
  ])
  const profiles = new Map(((profilesResult.data ?? []) as CircleProfile[]).map((profile) => [profile.id, profile]))
  const likedIds = new Set((likesResult.data ?? []).map((like) => like.reply_id))
  const reportedReplyIds = new Set((reportsResult.data ?? []).flatMap((report) => report.content_type === 'reply' && report.reply_id ? [report.reply_id] : []))
  const discussionReported = (reportsResult.data ?? []).some((report) => report.content_type === 'discussion' && report.discussion_id === discussionId)
  const knownIds = new Set(replyIds)
  const topLevel = new Set(rawReplies.filter((reply) => !reply.parent_reply_id || !knownIds.has(reply.parent_reply_id)).map((reply) => reply.id))
  const replies = rawReplies.map((reply, index) => ({
    id: reply.id, discussion_id: reply.discussion_id, parent_reply_id: reply.parent_reply_id, body: reply.body, created_at: reply.created_at,
    authorName: circleAuthorName(reply.author_id ? profiles.get(reply.author_id) : null), likeCount: countResults[index]?.error ? 0 : safeCount(countResults[index]?.data),
    liked: likedIds.has(reply.id), reported: reportedReplyIds.has(reply.id), own: reply.author_id === user?.id, nested: !topLevel.has(reply.id),
  })) as CircleReply[]
  return { user, replies, discussionReported, hasError: Boolean(repliesResult.error), truncated: (repliesResult.data?.length ?? 0) > CIRCLE_REPLY_LIMIT, discussionLikeCount: discussionCountResult.error ? 0 : safeCount(discussionCountResult.data) }
}

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
