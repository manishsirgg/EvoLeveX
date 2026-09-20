import { requireAdmin } from '@/lib/admin-auth'
import { getTvOptions } from '@/lib/admin-tv'
import { VideoEditor } from '../video-editor'
export default async function NewVideoPage() { await requireAdmin(); const options = await getTvOptions(); return <VideoEditor video={null} categories={options.categories} series={options.series} optionsError={options.hasError} /> }
