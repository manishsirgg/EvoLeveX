import { requireAdmin } from '@/lib/admin-auth'
import { SeriesEditor } from '../series-editor'
export default async function NewSeries(){await requireAdmin();return <SeriesEditor series={null}/>}
