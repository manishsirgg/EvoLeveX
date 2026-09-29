import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/admin-auth'
import { getVaultCategories, getVaultInstructors, getVaultProduct } from '@/lib/admin-vault'
import { getVaultProductImages } from '@/lib/vault-gallery'
import { getAdminVaultBookAssets } from '@/lib/admin-vault-book-assets'
import { ProductEditor } from '../../product-editor'

export default async function EditVaultProductPage({ params, searchParams }: { params: Promise<{id:string}>; searchParams: Promise<{success?:string;warning?:string}> }) {
  await requireAdmin(); const { id } = await params; const record = await getVaultProduct(id); if (!record) notFound()
  const [options, categoryOptions, gallery, bookAssets, query] = await Promise.all([getVaultInstructors(record.course?.instructor_id), getVaultCategories(record.product.category_id), getVaultProductImages(id), record.product.kind === 'book' ? getAdminVaultBookAssets(id) : Promise.resolve({ assets: [], hasError: false }), searchParams])
  return <ProductEditor {...record} categories={categoryOptions.categories} categoriesError={categoryOptions.hasError} instructors={options.instructors} instructorsError={options.hasError} galleryImages={gallery.images} galleryError={gallery.hasError} bookAssets={bookAssets.assets} bookAssetsError={bookAssets.hasError} feedback={query.success} warning={query.warning} />
}
