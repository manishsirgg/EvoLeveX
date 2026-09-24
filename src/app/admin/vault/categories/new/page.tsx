import { requireAdmin } from '@/lib/admin-auth'
import { CategoryEditor } from '../category-editor'

export default async function NewVaultCategoryPage() { await requireAdmin(); return <CategoryEditor category={null} /> }
