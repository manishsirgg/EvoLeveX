import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/admin-auth'
import { getVaultCategories, getVaultInstructors, getVaultProduct } from '@/lib/admin-vault'
import { getVaultProductImages } from '@/lib/vault-gallery'
import { ProductEditor } from '../../product-editor'

export default async function EditVaultProductPage({ params, searchParams }: { params: Promise<{id:string}>; searchParams: Promise<{success?:string;warning?:string}> }) {
  await requireAdmin(); const { id } = await params; const record = await getVaultProduct(id); if (!record) notFound()
  const [options, categoryOptions, gallery, query] = await Promise.all([getVaultInstructors(record.course?.instructor_id), getVaultCategories(record.product.category_id), getVaultProductImages(id), searchParams])
  return <ProductEditor {...record} categories={categoryOptions.categories} categoriesError={categoryOptions.hasError} instructors={options.instructors} instructorsError={options.hasError} galleryImages={gallery.images} galleryError={gallery.hasError} feedback={query.success} warning={query.warning} />
}
