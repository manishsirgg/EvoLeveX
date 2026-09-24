import { requireAdmin } from '@/lib/admin-auth'
import { getVaultInstructors } from '@/lib/admin-vault'
import { ProductEditor } from '../product-editor'

export default async function NewVaultProductPage() { await requireAdmin(); const options = await getVaultInstructors(); return <ProductEditor product={null} book={null} course={null} instructors={options.instructors} instructorsError={options.hasError} /> }
