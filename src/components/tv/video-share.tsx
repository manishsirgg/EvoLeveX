'use client'

import { ContentShare } from '@/components/shared/content-share'

export function VideoShare({ title, description, url }: { title: string; description: string | null; url: string }) {
  return <ContentShare title={title} text={description} url={url} menuHeading="Share Evo TV" triggerLabel="Share this video" menuLabel="Share video" nativeShareLabel="SHARE VIA DEVICE" emailBody={`I thought you might enjoy this Evo TV video:\n\n${url}`} />
}
