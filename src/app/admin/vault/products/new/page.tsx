import { requireAdmin } from '@/lib/admin-auth'
import { getVaultCategories, getVaultInstructors } from '@/lib/admin-vault'
import { ProductEditor } from '../product-editor'

export default async function NewVaultProductPage() { await requireAdmin(); const [options, categoryOptions] = await Promise.all([getVaultInstructors(), getVaultCategories()]); return <ProductEditor product={null} book={null} course={null} categories={categoryOptions.categories} categoriesError={categoryOptions.hasError} instructors={options.instructors} instructorsError={options.hasError} /> }
