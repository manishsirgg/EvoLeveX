import Link from 'next/link'
import { requireAdmin } from '@/lib/admin-auth'
import { ConnectionCheck } from './connection-check'
import { BlackUploadControl } from './black-upload-control'
import { NavyBlueUploadControls } from './navy-blue-upload-controls'
import { GalleryFinalizationControl } from './gallery-finalization-control'
import { CostInspectionControl } from './cost-inspection-control'
import { ShippingReadinessControl } from './shipping-readiness-control'
import { TokenScopeAuditControl } from './token-scope-audit-control'
import { ShippingProbeControl } from './shipping-probe-control'
import { LandedCostWorksheetControl } from './landed-cost-worksheet-control'
import { ProductionConfigurationControl } from './production-configuration-control'

export default async function PrintfulAdminPage() {
  await requireAdmin()
  return <section>
    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Evo Store · Integrations</p>
    <h1 className="mt-3 text-3xl font-semibold">Printful</h1>
    <p className="mt-3 text-zinc-400">Private connection diagnostics. Product synchronization is disabled.</p>
    <ConnectionCheck importEnabled={process.env.PRINTFUL_IMPORT_ENABLED === 'true' && process.env.PRINTFUL_STORE_ID === '18878485'} />
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
    <Link href="/admin/store" className="mt-6 inline-block text-sm text-amber-300">← Back to Evo Store</Link>
  </section>
}
