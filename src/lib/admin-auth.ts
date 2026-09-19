import { cache } from 'react'
import { notFound, redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'

const ADMIN_ROLE_NAMES = ['super_admin', 'admin'] as const

export const getAdminSession = cache(async () => {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) return { user: null, isAdmin: false }

  const { data: roleAssignments, error: assignmentError } = await supabase
    .from('user_roles')
    .select('role_id')
    .eq('user_id', user.id)

  if (assignmentError || !roleAssignments?.length) return { user, isAdmin: false }

  const roleIds = roleAssignments.map(({ role_id }) => role_id)
  const { data: roles, error: rolesError } = await supabase
    .from('roles')
    .select('name')
    .in('id', roleIds)
    .in('name', [...ADMIN_ROLE_NAMES])
    .limit(1)

  return { user, isAdmin: !rolesError && Boolean(roles?.length) }
})

export async function requireAdmin() {
  const session = await getAdminSession()

  if (!session.user) redirect('/auth/login')
  if (!session.isAdmin) notFound()

  return session.user
}
