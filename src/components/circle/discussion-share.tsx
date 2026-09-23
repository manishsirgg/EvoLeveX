'use client'

import { ContentShare } from '@/components/shared/content-share'

export function CircleDiscussionShare({ title, url }: { title: string; url: string }) {
  return <ContentShare title={title} text={null} url={url} menuHeading="Share this discussion" triggerLabel="Share this discussion" menuLabel="Share discussion" nativeShareLabel="SHARE VIA DEVICE" emailBody={`Join this Evo Circle discussion:\n\n${url}`} />
}
