import { redirect } from 'next/navigation'

import { isSafeInternalPath } from '@/lib/notifications'
import { createClient } from '@/lib/supabase/server'
import { markAllNotificationsRead, markNotificationRead, openNotification } from './actions'

type NotificationType = 'system' | 'circle' | 'commerce' | 'course' | 'content'

type Notification = {
  id: string
  type: NotificationType
  title: string
  body: string | null
  action_url: string | null
  is_read: boolean
  created_at: string
}

const typeLabels: Record<NotificationType, string> = {
  system: 'System',
  circle: 'Circle',
  commerce: 'Commerce',
  course: 'Course',
  content: 'Content',
}

function formatTimestamp(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) return 'Date unavailable'
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export default async function NotificationsPage() {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) redirect('/auth/login')

  const [{ data, error }, { count: unreadCountResult }] = await Promise.all([
    supabase
      .from('notifications')
      .select('id, type, title, body, action_url, is_read, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false),
  ])

  const notifications = (data ?? []) as Notification[]
  const unreadCount = unreadCountResult ?? 0

  return (
    <section aria-labelledby="notifications-title" className="space-y-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-300">Member updates</p>
          <h1 id="notifications-title" className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Notifications</h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-zinc-400">The latest activity from across your EvoLeveX account.</p>
        </div>
        {unreadCount > 0 ? (
          <form action={markAllNotificationsRead}>
            <button type="submit" className="button-secondary min-h-11 px-5 py-2.5 text-sm font-semibold">Mark all as read</button>
          </form>
        ) : null}
      </div>

      {error ? (
        <div role="alert" className="border border-amber-300/20 bg-amber-300/[0.05] p-5 text-sm leading-6 text-amber-100">
          Your notifications could not be loaded right now. Refresh the page to try again.
        </div>
      ) : notifications.length ? (
        <ol className="divide-y divide-white/10 border-y border-white/10">
          {notifications.map((notification) => {
            const safeDestination = isSafeInternalPath(notification.action_url)
            const markRead = markNotificationRead.bind(null, notification.id)
            const open = openNotification.bind(null, notification.id)

            return (
              <li key={notification.id} className={`relative grid gap-4 px-4 py-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:px-6 sm:py-6 ${notification.is_read ? 'bg-zinc-950/20' : 'bg-amber-300/[0.045]'}`}>
                {!notification.is_read ? <span aria-hidden="true" className="absolute inset-y-0 left-0 w-0.5 bg-amber-300" /> : null}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-amber-300">{typeLabels[notification.type]}</span>
                    {!notification.is_read ? <span className="rounded-full bg-amber-300/15 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-amber-200">Unread</span> : null}
                    <time dateTime={notification.created_at} className="text-xs text-zinc-500">{formatTimestamp(notification.created_at)}</time>
                  </div>
                  <h2 className={`mt-2 text-lg font-semibold ${notification.is_read ? 'text-zinc-300' : 'text-white'}`}>{notification.title}</h2>
                  {notification.body ? <p className="mt-2 max-w-3xl whitespace-pre-wrap text-sm leading-6 text-zinc-400">{notification.body}</p> : null}
                </div>
                <div className="flex items-center gap-4 sm:justify-end">
                  {safeDestination ? (
                    <form action={open}>
                      <button type="submit" className="text-sm font-semibold text-amber-200 underline decoration-amber-300/50 underline-offset-4 hover:text-amber-100">View</button>
                    </form>
                  ) : null}
                  {!notification.is_read ? (
                    <form action={markRead}>
                      <button type="submit" className="text-sm font-medium text-zinc-400 hover:text-white">Mark read</button>
                    </form>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ol>
      ) : (
        <div className="border border-white/10 bg-zinc-900/40 p-8 sm:p-10">
          <h2 className="text-xl font-semibold text-white">You’re all caught up.</h2>
          <p className="mt-3 max-w-xl text-sm leading-7 text-zinc-400">Account, Circle, course, and content updates will appear here when there is something new.</p>
        </div>
      )}
      <p className="text-xs leading-5 text-zinc-500">Showing your 20 most recent notifications.</p>
    </section>
  )
}
