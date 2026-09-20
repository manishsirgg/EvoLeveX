import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/admin-auth'
import { getTvOptions, getTvVideo } from '@/lib/admin-tv'
import { VideoEditor } from '../../video-editor'
export default async function EditVideoPage({ params, searchParams }: { params: Promise<{id:string}>; searchParams: Promise<{success?:string}> }) { await requireAdmin(); const {id}=await params; const video=await getTvVideo(id); if(!video) notFound(); const [options, query]=await Promise.all([getTvOptions(video.category_id,video.series_id),searchParams]); return <VideoEditor video={video} categories={options.categories} series={options.series} optionsError={options.hasError} feedback={query.success} /> }
