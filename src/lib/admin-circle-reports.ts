import { createClient } from '@/lib/supabase/server'

export const CIRCLE_REPORT_PAGE_SIZE = 20
export const REPORT_RESOLUTION_NOTE_MAX = 2000

export const REPORT_STATUSES = ['pending', 'reviewed', 'dismissed', 'action_taken'] as const
export const REPORT_CONTENT_TYPES = ['article', 'discussion', 'reply', 'evo_tv_video'] as const
export const REPORT_REASONS = ['spam', 'harassment', 'hate', 'misinformation', 'copyright', 'sexual_content', 'violence', 'other'] as const

export type ReportStatus = (typeof REPORT_STATUSES)[number]
export type ReportContentType = (typeof REPORT_CONTENT_TYPES)[number]
export type ReportReason = (typeof REPORT_REASONS)[number]
export type ReportFilter<T extends string> = T | 'all'

export type AdminReportProfile = { id: string; display_name: string | null; username: string | null }
export type AdminReportDiscussion = { id: string; author_id: string | null; title: string; body: string; status: 'published' | 'locked' | 'removed'; pinned: boolean; locked: boolean; created_at: string; updated_at: string; author: AdminReportProfile | null }
export type AdminReportReply = { id: string; discussion_id: string; parent_reply_id: string | null; author_id: string | null; body: string; status: 'published' | 'removed'; created_at: string; updated_at: string; author: AdminReportProfile | null; parent: { id: string; body: string; status: string; author_id: string | null; author: AdminReportProfile | null } | null }

type ReportRow = {
  id: string; reporter_id: string; content_type: ReportContentType; article_id: string | null
  discussion_id: string | null; reply_id: string | null; evo_tv_video_id: string | null
  reason: ReportReason; details: string | null; status: ReportStatus; reviewed_by: string | null
  reviewed_at: string | null; resolution_note: string | null; created_at: string; updated_at: string
}

export type AdminReport = ReportRow & {
  reporter: AdminReportProfile | null
  reviewer: AdminReportProfile | null
  target: { id: string | null; title: string | null; status: string; available: boolean }
}

export type AdminReportDetail = AdminReport & {
  discussion: AdminReportDiscussion | null
  reply: AdminReportReply | null
  owningDiscussion: AdminReportDiscussion | null
}

const reportFields = 'id,reporter_id,content_type,article_id,discussion_id,reply_id,evo_tv_video_id,reason,details,status,reviewed_by,reviewed_at,resolution_note,created_at,updated_at'
const discussionFields = 'id,author_id,title,body,status,pinned,locked,created_at,updated_at'

function unique(values: (string | null)[]) { return [...new Set(values.filter((value): value is string => Boolean(value)))] }
function emptyResult<T>() { return Promise.resolve({ data: [] as T[], error: null }) }
function profileMap(rows: AdminReportProfile[] | null) { return new Map((rows ?? []).map((row) => [row.id, row])) }
function targetId(report: ReportRow) {
  if (report.content_type === 'discussion') return report.discussion_id
  if (report.content_type === 'reply') return report.reply_id
  if (report.content_type === 'article') return report.article_id
  return report.evo_tv_video_id
}

export function reportProfileName(profile: AdminReportProfile | null) {
  if (!profile) return 'Unknown or deleted member'
  return profile.display_name?.trim() || (profile.username?.trim() ? `@${profile.username.trim()}` : 'Unnamed member')
}

export function reportLabel(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export async function getPendingReportCount() {
  const supabase = await createClient()
  const { count, error } = await supabase.from('content_reports').select('id', { count: 'exact', head: true }).eq('status', 'pending')
  return { count: count ?? 0, hasError: Boolean(error) }
}

export async function getAdminReports(options: { status: ReportFilter<ReportStatus>; contentType: ReportFilter<ReportContentType>; reason: ReportFilter<ReportReason>; page: number }) {
  const supabase = await createClient()
  const from = (options.page - 1) * CIRCLE_REPORT_PAGE_SIZE
  let query = supabase.from('content_reports').select(reportFields, { count: 'exact' }).order('created_at', { ascending: false }).order('id', { ascending: false }).range(from, from + CIRCLE_REPORT_PAGE_SIZE - 1)
  if (options.status !== 'all') query = query.eq('status', options.status)
  if (options.contentType !== 'all') query = query.eq('content_type', options.contentType)
  if (options.reason !== 'all') query = query.eq('reason', options.reason)
  const { data, error, count } = await query
  if (error) return { reports: [] as AdminReport[], count: 0, hasError: true }
  const rows = (data ?? []) as ReportRow[]
  const discussionIds = unique(rows.map((row) => row.discussion_id))
  const replyIds = unique(rows.map((row) => row.reply_id))
  const articleIds = unique(rows.map((row) => row.article_id))
  const videoIds = unique(rows.map((row) => row.evo_tv_video_id))
  const profileIds = unique(rows.flatMap((row) => [row.reporter_id, row.reviewed_by]))
  const [profilesResult, discussionsResult, repliesResult, articlesResult, videosResult] = await Promise.all([
    profileIds.length ? supabase.from('profiles').select('id,display_name,username').in('id', profileIds) : emptyResult<AdminReportProfile>(),
    discussionIds.length ? supabase.from('evo_circle_discussions').select('id,title,status').in('id', discussionIds) : emptyResult<{ id: string; title: string; status: string }>(),
    replyIds.length ? supabase.from('evo_circle_replies').select('id,discussion_id,status,body').in('id', replyIds) : emptyResult<{ id: string; discussion_id: string; status: string; body: string }>(),
    articleIds.length ? supabase.from('evo_daily_articles').select('id,title,status').in('id', articleIds) : emptyResult<{ id: string; title: string; status: string }>(),
    videoIds.length ? supabase.from('evo_tv_videos').select('id,title,active').in('id', videoIds) : emptyResult<{ id: string; title: string; active: boolean }>(),
  ])
  const profiles = profileMap(profilesResult.data as AdminReportProfile[] | null)
  const discussions = new Map((discussionsResult.data ?? []).map((item) => [item.id, item]))
  const replies = new Map((repliesResult.data ?? []).map((item) => [item.id, item]))
  const articles = new Map((articlesResult.data ?? []).map((item) => [item.id, item]))
  const videos = new Map((videosResult.data ?? []).map((item) => [item.id, item]))
  const reports = rows.map((row): AdminReport => {
    const id = targetId(row)
    let item: { title?: string; body?: string; status?: string; active?: boolean } | undefined
    if (row.content_type === 'discussion' && id) item = discussions.get(id)
    if (row.content_type === 'reply' && id) item = replies.get(id)
    if (row.content_type === 'article' && id) item = articles.get(id)
    if (row.content_type === 'evo_tv_video' && id) item = videos.get(id)
    return { ...row, reporter: profiles.get(row.reporter_id) ?? null, reviewer: row.reviewed_by ? profiles.get(row.reviewed_by) ?? null : null, target: { id, title: item?.title ?? (item?.body ? item.body.slice(0, 100) : null), status: item ? (item.status ?? (item.active ? 'active' : 'inactive')) : 'unavailable', available: Boolean(item) } }
  })
  return { reports, count: count ?? 0, hasError: Boolean(profilesResult.error || discussionsResult.error || repliesResult.error || articlesResult.error || videosResult.error) }
}

export async function getAdminReport(id: string) {
  const supabase = await createClient()
  const reportResult = await supabase.from('content_reports').select(reportFields).eq('id', id).maybeSingle()
  if (reportResult.error) return { report: null as AdminReportDetail | null, hasError: true }
  if (!reportResult.data) return { report: null as AdminReportDetail | null, hasError: false }
  const row = reportResult.data as ReportRow
  const [discussionResult, replyResult] = await Promise.all([
    row.content_type === 'discussion' && row.discussion_id ? supabase.from('evo_circle_discussions').select(discussionFields).eq('id', row.discussion_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    row.reply_id ? supabase.from('evo_circle_replies').select('id,discussion_id,parent_reply_id,author_id,body,status,created_at,updated_at').eq('id', row.reply_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ])
  const reply = replyResult.data as Omit<AdminReportReply, 'author' | 'parent'> | null
  const owningId = reply?.discussion_id ?? null
  const [owningResult, parentResult, articleResult, videoResult] = await Promise.all([
    owningId ? supabase.from('evo_circle_discussions').select(discussionFields).eq('id', owningId).maybeSingle() : Promise.resolve({ data: null, error: null }),
    reply?.parent_reply_id ? supabase.from('evo_circle_replies').select('id,author_id,body,status').eq('id', reply.parent_reply_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    row.article_id ? supabase.from('evo_daily_articles').select('id,title,status').eq('id', row.article_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    row.evo_tv_video_id ? supabase.from('evo_tv_videos').select('id,title,active').eq('id', row.evo_tv_video_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ])
  const discussionRaw = discussionResult.data as Omit<AdminReportDiscussion, 'author'> | null
  const owningRaw = owningResult.data as Omit<AdminReportDiscussion, 'author'> | null
  const parentRaw = parentResult.data as { id: string; body: string; status: string; author_id: string | null } | null
  const profileIds = unique([row.reporter_id, row.reviewed_by, discussionRaw?.author_id ?? null, owningRaw?.author_id ?? null, reply?.author_id ?? null, parentRaw?.author_id ?? null])
  const profilesResult = profileIds.length ? await supabase.from('profiles').select('id,display_name,username').in('id', profileIds) : { data: [] as AdminReportProfile[], error: null }
  const profiles = profileMap(profilesResult.data as AdminReportProfile[] | null)
  const decorateDiscussion = (item: Omit<AdminReportDiscussion, 'author'> | null) => item ? { ...item, author: item.author_id ? profiles.get(item.author_id) ?? null : null } : null
  const discussion = decorateDiscussion(discussionRaw)
  const owningDiscussion = decorateDiscussion(owningRaw)
  const decoratedReply: AdminReportReply | null = reply ? { ...reply, author: reply.author_id ? profiles.get(reply.author_id) ?? null : null, parent: parentRaw ? { ...parentRaw, author: parentRaw.author_id ? profiles.get(parentRaw.author_id) ?? null : null } : null } : null
  let target: AdminReport['target'] = { id: targetId(row), title: null, status: 'unavailable', available: false }
  if (discussion) target = { id: discussion.id, title: discussion.title, status: discussion.status, available: true }
  else if (decoratedReply) target = { id: decoratedReply.id, title: decoratedReply.body.slice(0, 100), status: decoratedReply.status, available: true }
  else if (articleResult.data) target = { id: articleResult.data.id, title: articleResult.data.title, status: articleResult.data.status, available: true }
  else if (videoResult.data) target = { id: videoResult.data.id, title: videoResult.data.title, status: videoResult.data.active ? 'active' : 'inactive', available: true }
  return { report: { ...row, reporter: profiles.get(row.reporter_id) ?? null, reviewer: row.reviewed_by ? profiles.get(row.reviewed_by) ?? null : null, target, discussion, reply: decoratedReply, owningDiscussion }, hasError: Boolean(discussionResult.error || replyResult.error || owningResult.error || parentResult.error || articleResult.error || videoResult.error || profilesResult.error) }
}
