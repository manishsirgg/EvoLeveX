import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/admin-auth'
import { createClient } from '@/lib/supabase/server'
import { SeriesEditor, SeriesRecord } from '../../series-editor'
export default async function EditSeries({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{success?:string}>}){await requireAdmin();const {id}=await params;const supabase=await createClient();const {data}=await supabase.from('evo_tv_series').select('id,title,slug,description,thumbnail_url,is_active,sort_order').eq('id',id).maybeSingle();if(!data)notFound();const query=await searchParams;return <SeriesEditor series={data as SeriesRecord} feedback={query.success}/>}
