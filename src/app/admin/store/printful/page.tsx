import Link from 'next/link'
import { requireAdmin } from '@/lib/admin-auth'
import { ConnectionCheck } from './connection-check'
import { CatalogSyncDiscoveryControl } from './catalog-sync-discovery-control'
import { CatalogReconciliationPreview } from './catalog-reconciliation-preview'

export default async function PrintfulAdminPage() {
  await requireAdmin()
  return <section>
    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Evo Store · Integrations</p>
    <h1 className="mt-3 text-3xl font-semibold">Printful product synchronization</h1>
    <p className="mt-3 text-zinc-400">Discover Printful products, match them to Evo Store records and prepare controlled draft imports. Checkout and automated fulfillment are not yet enabled.</p>
    <ConnectionCheck importEnabled={false} />
    <CatalogSyncDiscoveryControl />
    <CatalogReconciliationPreview />
    <details className="mt-8 border border-white/10 p-5">
      <summary className="cursor-pointer text-sm font-semibold text-zinc-300">Legacy Printful diagnostics</summary>
      <p className="mt-3 text-sm text-zinc-400">Previous one-off upload, primary-image, shipping and artwork audits are retired from the daily operations screen. Their database protections and historical records remain unchanged.</p>
    </details>
    <Link href="/admin/store" className="mt-6 inline-block text-sm text-amber-300">← Back to Evo Store</Link>
  </section>
}
