import Link from 'next/link'
import { requireAdmin } from '@/lib/admin-auth'

export default async function EditArticlePlaceholder() {
  await requireAdmin()
  return <section><p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Stage 2B</p><h1 className="mt-3 text-3xl font-semibold">Article editor</h1><p className="mt-4 max-w-xl leading-7 text-zinc-400">Editing will be available in the next stage. This protected route does not currently load or change article content.</p><Link href="/admin/daily" className="mt-7 inline-flex border border-white/20 px-5 py-3 text-sm font-semibold hover:border-white/50">Back to articles</Link></section>
}
