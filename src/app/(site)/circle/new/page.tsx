import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { DiscussionComposer } from '@/components/circle/discussion-composer'
import { getActiveCircleTopics } from '@/lib/circle'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Start a discussion | Evo Circle',
  description: 'Start a new member discussion in Evo Circle.',
  robots: { index: false, follow: false },
}

export default async function NewCircleDiscussionPage() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) redirect('/auth/login?next=%2Fcircle%2Fnew')
  const { topics, hasError } = await getActiveCircleTopics()

  return (
    <main className="circle-page circle-new-page">
      <Link href="/circle" className="circle-back-link">← Back to Evo Circle</Link>
      <header className="circle-new-header">
        <p className="section-kicker">Evo Circle / Member discussion</p>
        <h1>Start a conversation worth having.</h1>
        <p>Bring a clear question or a considered point of view. Give the Circle enough context to respond with substance.</p>
      </header>
      {hasError || topics.length === 0 ? (
        <div className="circle-notice" role="status"><p>COMPOSER UNAVAILABLE</p><h2>Topics could not be loaded.</h2><span>Please return shortly to start your discussion.</span></div>
      ) : <DiscussionComposer topics={topics} />}
    </main>
  )
}
