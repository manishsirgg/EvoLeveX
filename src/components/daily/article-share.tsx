'use client'

import { ContentShare } from '@/components/shared/content-share'

type ArticleShareProps = { title: string; excerpt: string | null; url: string }

export function ArticleShare({ title, excerpt, url }: ArticleShareProps) {
  return <ContentShare title={title} text={excerpt} url={url} menuHeading="Share Evo Daily" triggerLabel="Share this article" menuLabel="Share article" nativeShareLabel="SHARE VIA DEVICE" emailBody={`I thought you might enjoy this Evo Daily article:\n\n${url}`} />
}
