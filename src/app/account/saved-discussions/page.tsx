import Link from 'next/link'
import { redirect } from 'next/navigation'

import { CircleDiscussionCard } from '@/components/circle/discussion-card'
import { circleAuthorName, type CircleDiscussionSummary, type CircleTopic } from '@/lib/circle'
import { createClient } from '@/lib/supabase/server'

type BookmarkRow = { discussion_id: string; created_at: string }
type DiscussionRow = Omit<CircleDiscussionSummary, 'topic' | 'authorName'>
type ProfileRow = { id: string; display_name: string | null; username: string | null }

const savedDiscussionFields = 'id,topic_id,author_id,title,slug,pinned,locked,view_count,created_at'
const SAVED_DISCUSSION_LIMIT = 100

export default async function SavedDiscussionsPage() {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) redirect('/auth/login')

  const { data: bookmarkData, error: bookmarkError } = await supabase
    .from('evo_circle_discussion_bookmarks')
    .select('discussion_id,created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .order('discussion_id', { ascending: true })
    .limit(SAVED_DISCUSSION_LIMIT)

  const bookmarks = (bookmarkData ?? []) as BookmarkRow[]
  const discussionIds = bookmarks.map((bookmark) => bookmark.discussion_id)
  const { data: discussionData, error: discussionError } = discussionIds.length
    ? await supabase.from('evo_circle_discussions').select(savedDiscussionFields).in('id', discussionIds).eq('status', 'published')
    : { data: [], error: null }
  const rows = (discussionData ?? []) as DiscussionRow[]
  const topicIds = [...new Set(rows.flatMap((row) => row.topic_id ? [row.topic_id] : []))]
  const authorIds = [...new Set(rows.flatMap((row) => row.author_id ? [row.author_id] : []))]
  const [topicResult, profileResult] = await Promise.all([
    topicIds.length
      ? supabase.from('evo_circle_topics').select('id,name,slug').eq('is_active', true).in('id', topicIds)
      : Promise.resolve({ data: [], error: null }),
    authorIds.length
      ? supabase.from('profiles').select('id,display_name,username').in('id', authorIds)
      : Promise.resolve({ data: [], error: null }),
  ])
  const topics = new Map(((topicResult.data ?? []) as Pick<CircleTopic, 'id' | 'name' | 'slug'>[]).map((topic) => [topic.id, topic]))
  const profiles = new Map(((profileResult.data ?? []) as ProfileRow[]).map((profile) => [profile.id, profile]))
  const byId = new Map(rows.map((row): [string, CircleDiscussionSummary] => [row.id, {
    ...row,
    topic: row.topic_id ? topics.get(row.topic_id) ?? null : null,
    authorName: circleAuthorName(row.author_id ? profiles.get(row.author_id) : null),
  }]))
  const discussions = discussionIds.flatMap((id) => byId.get(id) ?? [])
  const hasError = Boolean(bookmarkError || discussionError || topicResult.error || profileResult.error)

  return <section aria-labelledby="saved-discussions-title" className="space-y-8">
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-300">Your conversations</p>
      <h1 id="saved-discussions-title" className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Saved Discussions</h1>
      <p className="mt-3 max-w-2xl text-base leading-7 text-zinc-400">Return to the Evo Circle conversations that matter to you.</p>
    </div>

    {hasError ? <div role="alert" className="border border-amber-300/20 bg-amber-300/[0.05] p-5 text-sm leading-6 text-amber-100">
      Your saved discussions could not be loaded right now. Refresh the page to try again.
    </div> : discussions.length ? <div className="circle-discussion-list account-saved-discussion-list">
      {discussions.map((discussion) => <CircleDiscussionCard key={discussion.id} discussion={discussion} />)}
    </div> : <div className="border border-white/10 bg-zinc-900/40 p-8 sm:p-10">
      <h2 className="text-xl font-semibold text-white">Your Circle collection is ready.</h2>
      <p className="mt-3 max-w-xl text-sm leading-7 text-zinc-400">Save a public Evo Circle discussion and it will appear here for easy access.</p>
      <Link href="/circle" className="button-light mt-6 inline-flex px-5 py-3 text-sm">Explore Evo Circle</Link>
    </div>}
  </section>
}
