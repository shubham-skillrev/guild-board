import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/Section'
import { NotificationsList } from '@/components/notifications/NotificationsList'

export const metadata: Metadata = { title: 'Notifications' }

/** Everything GuildBoard sent you in the last 90 days, push or not. */
export default async function NotificationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return (
    <div className="px-(--pad-page-x) py-8 w-full max-w-2xl mx-auto pb-28 md:pb-10">
      <PageHeader title="Notifications" />
      <NotificationsList />
    </div>
  )
}
