import { createClient } from '@/lib/supabase/server'

export const CIRCLE_DISCUSSION_PAGE_SIZE = 20
export const CIRCLE_REPLY_LIMIT = 200

export type CircleDiscussionFilter = 'all' | 'published' | 'removed' | 'pinned' | 'locked'
export type CircleDiscussionStatus = 'published' | 'removed' | 'locked'

type CountRelation = { count: number }[]

type DiscussionRow = {
  id: string
  topic_id: string | null
  author_id: string | null
  title: string
  slug: string
  body: string
  status: CircleDiscussionStatus
  pinned: boolean
  locked: boolean
  view_count: number
  created_at: string
  updated_at: string
  reply_count: CountRelation
  like_count: CountRelation
}

type ReplyRow = {
  id: string
  parent_reply_id: string | null
  author_id: string | null
  body: string
  status: string
  created_at: string
  updated_at: string
}

type Topic = { id: string; name: string; icon: string | null }
type Profile = { id: string; display_name: string | null; username: string | null }

export type AdminCircleDiscussion = Omit<DiscussionRow, 'reply_count' | 'like_count'> & {
  replyCount: number
  likeCount: number
  topic: Topic | null
  author: Profile | null
}

export type AdminCircleReply = ReplyRow & { author: Profile | null }

const discussionListProjection = `
  id,topic_id,author_id,title,slug,status,pinned,locked,view_count,created_at,updated_at,
  reply_count:evo_circle_replies(count),
  like_count:evo_circle_discussion_likes(count)
`

const discussionDetailProjection = `
  id,topic_id,author_id,title,slug,body,status,pinned,locked,view_count,created_at,updated_at,
  reply_count:evo_circle_replies(count),
  like_count:evo_circle_discussion_likes(count)
`

function relationCount(value: CountRelation | null | undefined) {
  return value?.[0]?.count ?? 0
}

async function enrichDiscussions(rows: DiscussionRow[]) {
  const supabase = await createClient()
  const topicIds = [...new Set(rows.flatMap((row) => row.topic_id ? [row.topic_id] : []))]
  const authorIds = [...new Set(rows.flatMap((row) => row.author_id ? [row.author_id] : []))]
  const [topicsResult, profilesResult] = await Promise.all([
    topicIds.length
      ? supabase.from('evo_circle_topics').select('id,name,icon').in('id', topicIds)
      : Promise.resolve({ data: [] as Topic[], error: null }),
    authorIds.length
      ? supabase.from('profiles').select('id,display_name,username').in('id', authorIds)
      : Promise.resolve({ data: [] as Profile[], error: null }),
  ])
  const topics = new Map((topicsResult.data ?? []).map((topic) => [topic.id, topic as Topic]))
  const profiles = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile as Profile]))

  return {
    discussions: rows.map((row) => ({
      ...row,
      replyCount: relationCount(row.reply_count),
      likeCount: relationCount(row.like_count),
      topic: row.topic_id ? topics.get(row.topic_id) ?? null : null,
      author: row.author_id ? profiles.get(row.author_id) ?? null : null,
    })),
    hasRelatedDataError: Boolean(topicsResult.error || profilesResult.error),
  }
}

export async function getAdminCircleDiscussions(options: {
  filter: CircleDiscussionFilter
  topicId: string | null
  search: string
  page: number
}) {
  const supabase = await createClient()
  const from = (options.page - 1) * CIRCLE_DISCUSSION_PAGE_SIZE
  const to = from + CIRCLE_DISCUSSION_PAGE_SIZE - 1
  let query = supabase
    .from('evo_circle_discussions')
    .select(discussionListProjection, { count: 'exact' })
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(from, to)

  if (options.filter === 'published' || options.filter === 'removed') query = query.eq('status', options.filter)
  if (options.filter === 'pinned') query = query.eq('pinned', true)
  if (options.filter === 'locked') query = query.eq('locked', true)
  if (options.topicId) query = query.eq('topic_id', options.topicId)
  if (options.search) {
    const term = options.search.replace(/[^\p{L}\p{N} \-']/gu, '').slice(0, 80)
    if (term) query = query.or(`title.ilike.%${term}%,slug.ilike.%${term}%`)
  }

  const { data, error, count } = await query
  if (error) return { discussions: [] as AdminCircleDiscussion[], count: 0, hasError: true }
  const enriched = await enrichDiscussions((data ?? []).map((row) => ({ ...row, body: '' })) as unknown as DiscussionRow[])
  return { discussions: enriched.discussions, count: count ?? 0, hasError: enriched.hasRelatedDataError }
}

export async function getCircleTopicOptions() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('evo_circle_topics')
    .select('id,name,icon')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })
    .limit(200)
  return { topics: (data ?? []) as Topic[], hasError: Boolean(error) }
}

export async function getAdminCircleDiscussion(id: string) {
  const supabase = await createClient()
  const discussionResult = await supabase
    .from('evo_circle_discussions')
    .select(discussionDetailProjection)
    .eq('id', id)
    .maybeSingle()

  if (discussionResult.error) return { discussion: null, replies: [] as AdminCircleReply[], hasError: true, repliesTruncated: false }
  if (!discussionResult.data) return { discussion: null, replies: [] as AdminCircleReply[], hasError: false, repliesTruncated: false }

  const enriched = await enrichDiscussions([discussionResult.data as unknown as DiscussionRow])
  const repliesResult = await supabase
    .from('evo_circle_replies')
    .select('id,parent_reply_id,author_id,body,status,created_at,updated_at')
    .eq('discussion_id', id)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
    .limit(CIRCLE_REPLY_LIMIT)
  const replyRows = (repliesResult.data ?? []) as ReplyRow[]
  const authorIds = [...new Set(replyRows.flatMap((reply) => reply.author_id ? [reply.author_id] : []))]
  const profilesResult = authorIds.length
    ? await supabase.from('profiles').select('id,display_name,username').in('id', authorIds)
    : { data: [] as Profile[], error: null }
  const profiles = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile as Profile]))

  return {
    discussion: enriched.discussions[0],
    replies: replyRows.map((reply) => ({ ...reply, author: reply.author_id ? profiles.get(reply.author_id) ?? null : null })),
    hasError: enriched.hasRelatedDataError || Boolean(repliesResult.error || profilesResult.error),
    repliesTruncated: enriched.discussions[0].replyCount > CIRCLE_REPLY_LIMIT,
  }
}

export function circleAuthorName(profile: Profile | null) {
  if (!profile) return 'Unknown or deleted member'
  return profile.display_name || (profile.username ? `@${profile.username}` : 'Unnamed member')
}
