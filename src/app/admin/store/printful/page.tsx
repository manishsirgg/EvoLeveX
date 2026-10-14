import Link from 'next/link'
import { requireAdmin } from '@/lib/admin-auth'
import { ConnectionCheck } from './connection-check'
import { CatalogSyncDiscoveryControl } from './catalog-sync-discovery-control'
import { CatalogReconciliationPreview } from './catalog-reconciliation-preview'
import { DraftSyncControl } from './draft-sync-control'
import { HoodieMediaPricingPreflight } from './hoodie-media-pricing-preflight'
import { HoodieReconciliationPlan } from './hoodie-reconciliation-plan'
import { HoodiePriceSeedControl } from './hoodie-price-seed-control'
import { HoodieMockupUploadControl } from './hoodie-mockup-upload-control'
import { BlackUploadControl } from './black-upload-control'
import { NavyBlueUploadControls } from './navy-blue-upload-controls'
import { GalleryFinalizationControl } from './gallery-finalization-control'
import { CostInspectionControl } from './cost-inspection-control'
import { ShippingReadinessControl } from './shipping-readiness-control'
import { TokenScopeAuditControl } from './token-scope-audit-control'
import { ShippingProbeControl } from './shipping-probe-control'
import { LandedCostWorksheetControl } from './landed-cost-worksheet-control'
import { ProductionConfigurationControl } from './production-configuration-control'
import { BlackSFileAuditControl } from './black-s-file-audit-control'

export default async function PrintfulAdminPage() {
  await requireAdmin()
  return <section>
    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Evo Store · Integrations</p>
    <h1 className="mt-3 text-3xl font-semibold">Printful product synchronization</h1>
    <p className="mt-3 text-zinc-400">Discover Printful products, match them to Evo Store records and prepare controlled draft imports. Checkout and automated fulfillment are not yet enabled.</p>
    <ConnectionCheck importEnabled={process.env.PRINTFUL_IMPORT_ENABLED === 'true' && process.env.PRINTFUL_STORE_ID === '18878485'} />
    <CatalogSyncDiscoveryControl />
    <CatalogReconciliationPreview />
    <DraftSyncControl />
    <HoodieMediaPricingPreflight />
    <HoodieReconciliationPlan />
    <HoodiePriceSeedControl />
    <HoodieMockupUploadControl authorized={process.env.PRINTFUL_MEDIA_UPLOAD_ENABLED === 'true' && process.env.PRINTFUL_HOODIE_MEDIA_UPLOAD_ENABLED === 'true'} />
    <details className="mt-8 border border-white/10 p-5">
      <summary className="cursor-pointer text-sm font-semibold text-zinc-300">Legacy Printful diagnostics</summary>
      <p className="mt-3 text-sm text-zinc-400">Legacy diagnostics remain available for controlled recovery and security review. All independent authorization flags and server-side protections remain unchanged.</p>
    <BlackUploadControl authorized={process.env.PRINTFUL_FIRST_BLACK_UPLOAD_ENABLED === 'true' && process.env.PRINTFUL_MEDIA_UPLOAD_ENABLED === 'true'} />
    <NavyBlueUploadControls
      navyAuthorized={process.env.PRINTFUL_MEDIA_UPLOAD_ENABLED === 'true' && process.env.PRINTFUL_NAVY_UPLOAD_ENABLED === 'true' && process.env.PRINTFUL_BLUE_UPLOAD_ENABLED !== 'true' && process.env.PRINTFUL_FIRST_BLACK_UPLOAD_ENABLED !== 'true'}
      blueAuthorized={process.env.PRINTFUL_MEDIA_UPLOAD_ENABLED === 'true' && process.env.PRINTFUL_BLUE_UPLOAD_ENABLED === 'true' && process.env.PRINTFUL_NAVY_UPLOAD_ENABLED !== 'true' && process.env.PRINTFUL_FIRST_BLACK_UPLOAD_ENABLED !== 'true'}
    />
    <GalleryFinalizationControl authorized={process.env.PRINTFUL_GALLERY_FINALIZATION_ENABLED === 'true' && ['PRINTFUL_MEDIA_UPLOAD_ENABLED','PRINTFUL_FIRST_BLACK_UPLOAD_ENABLED','PRINTFUL_NAVY_UPLOAD_ENABLED','PRINTFUL_BLUE_UPLOAD_ENABLED','PRINTFUL_IMPORT_ENABLED'].every(key => process.env[key] !== 'true')} />
    <CostInspectionControl />
    <ShippingReadinessControl />
    <TokenScopeAuditControl />
    <ShippingProbeControl enabled={process.env.PRINTFUL_SHIPPING_PROBE_ENABLED === 'true' && process.env.PRINTFUL_STORE_ID === '18878485'} />
    <LandedCostWorksheetControl />
    <ProductionConfigurationControl />
    <BlackSFileAuditControl />

    </details>
    <Link href="/admin/store" className="mt-6 inline-block text-sm text-amber-300">← Back to Evo Store</Link>
  </section>
}
