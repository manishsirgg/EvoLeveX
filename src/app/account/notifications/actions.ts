'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { isSafeInternalPath } from '@/lib/notifications'
import { createClient } from '@/lib/supabase/server'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function revalidateNotifications() {
  revalidatePath('/account/notifications')
  revalidatePath('/account', 'layout')
  revalidatePath('/', 'layout')
}

async function authenticatedClient() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new Error('Authentication required.')
  return { supabase, user }
}

export async function markNotificationRead(notificationId: string) {
  if (!UUID.test(notificationId)) return
  const { supabase, user } = await authenticatedClient()
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .eq('user_id', user.id)

  if (!error) revalidateNotifications()
}

export async function markAllNotificationsRead() {
  const { supabase, user } = await authenticatedClient()
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .eq('is_read', false)

  if (!error) revalidateNotifications()
}

export async function openNotification(notificationId: string) {
  if (!UUID.test(notificationId)) redirect('/account/notifications')
  const { supabase, user } = await authenticatedClient()
  const { data } = await supabase
    .from('notifications')
    .select('action_url, is_read')
    .eq('id', notificationId)
    .eq('user_id', user.id)
    .maybeSingle()

  const actionUrl = data?.action_url ?? null
  const destination = isSafeInternalPath(actionUrl)
    ? actionUrl
    : '/account/notifications'

  if (data && !data.is_read) {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', notificationId)
      .eq('user_id', user.id)
    if (!error) revalidateNotifications()
  }

  redirect(destination)
}
