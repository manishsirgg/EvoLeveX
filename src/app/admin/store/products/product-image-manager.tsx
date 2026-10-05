import type { StoreAdminProductImage } from '@/lib/admin-store'
import { ProductImageCard } from './product-image-card'
import { ProductImageUpload } from './product-image-upload'

export function ProductImageManager({ productId, images, archived, hasError }: { productId: string; images: StoreAdminProductImage[]; archived: boolean; hasError: boolean }) {
  return <section className="mt-8 border border-white/10 p-5 sm:p-7">
    <h2 className="text-xl font-semibold">Product images</h2>
    <p className="mt-2 text-sm text-zinc-400">Private previews expire after five minutes. Inactive images and incomplete uploads do not satisfy publication readiness.</p>
    {archived ? <p className="mt-4 border border-amber-300/30 p-3 text-sm text-amber-100">Archived product images are read-only.</p> : <ProductImageUpload productId={productId} />}
    {hasError ? <p role="alert" className="mt-4 text-sm text-rose-200">Some image data or previews could not be loaded. Refresh to try again.</p> : null}
    {images.length ? <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{images.map((image) => <ProductImageCard key={image.id} image={image} readOnly={archived} />)}</div> : <p className="mt-5 text-sm text-zinc-500">No images have been added.</p>}
  </section>
}
