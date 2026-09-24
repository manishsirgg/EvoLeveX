import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/admin-auth'
import { getVaultInstructors, getVaultProduct } from '@/lib/admin-vault'
import { ProductEditor } from '../../product-editor'

export default async function EditVaultProductPage({ params, searchParams }: { params: Promise<{id:string}>; searchParams: Promise<{success?:string}> }) {
  await requireAdmin(); const { id } = await params; const record = await getVaultProduct(id); if (!record) notFound()
  const [options, query] = await Promise.all([getVaultInstructors(record.course?.instructor_id), searchParams])
  return <ProductEditor {...record} instructors={options.instructors} instructorsError={options.hasError} feedback={query.success} />
}
