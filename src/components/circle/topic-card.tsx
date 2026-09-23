import Link from 'next/link'

import type { CircleTopic } from '@/lib/circle'

export function CircleTopicCard({ topic, index }: { topic: CircleTopic; index: number }) {
  return (
    <Link className="circle-topic-card" href={`/circle/topic/${encodeURIComponent(topic.slug)}`}>
      <span className="circle-topic-number">{String(index + 1).padStart(2, '0')}</span>
      {topic.icon ? <span className="circle-topic-icon" aria-hidden="true">{topic.icon}</span> : null}
      <h3>{topic.name}</h3>
      {topic.description ? <p>{topic.description}</p> : null}
      <strong>Explore topic <span aria-hidden="true">→</span></strong>
    </Link>
  )
}
