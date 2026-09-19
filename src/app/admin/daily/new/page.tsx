import Link from 'next/link'
import { requireAdmin } from '@/lib/admin-auth'

export default async function NewArticlePlaceholder() {
  await requireAdmin()
  return <section><p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Stage 2B</p><h1 className="mt-3 text-3xl font-semibold">New Article</h1><p className="mt-4 max-w-xl leading-7 text-zinc-400">The Evo Daily publishing editor is the next stage. No article changes can be made here yet.</p><Link href="/admin/daily" className="mt-7 inline-flex border border-white/20 px-5 py-3 text-sm font-semibold hover:border-white/50">Back to articles</Link></section>
}
