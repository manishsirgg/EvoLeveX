import { requireAdmin } from '@/lib/admin-auth'
import { TopicEditor } from '../topic-editor'

export default async function NewCircleTopicPage() {
  await requireAdmin()
  return <TopicEditor topic={null} />
}
