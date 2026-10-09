import Link from 'next/link'
import { requireAdmin } from '@/lib/admin-auth'
import { ConnectionCheck } from './connection-check'

export default async function PrintfulAdminPage() {
  await requireAdmin()
  return <section>
    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Evo Store · Integrations</p>
    <h1 className="mt-3 text-3xl font-semibold">Printful</h1>
    <p className="mt-3 text-zinc-400">Private connection diagnostics. Product synchronization is disabled.</p>
    <ConnectionCheck />
    <Link href="/admin/store" className="mt-6 inline-block text-sm text-amber-300">← Back to Evo Store</Link>
  </section>
}
