import { notFound } from 'next/navigation'

import { requireAdmin } from '@/lib/admin-auth'
import { createClient } from '@/lib/supabase/server'
import { TopicEditor } from '../../topic-editor'
import type { CircleTopicRecord } from '../../topic-editor'

export default async function EditCircleTopicPage({ params, searchParams }: PageProps<'/admin/circle/topics/[id]/edit'>) {
  await requireAdmin()
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase
    .from('evo_circle_topics')
    .select('id,name,slug,description,icon,sort_order,is_active')
    .eq('id', id)
    .maybeSingle()

  if (!data) notFound()

  const query = await searchParams
  return <TopicEditor topic={data as CircleTopicRecord} saved={query.success === 'saved'} />
}
