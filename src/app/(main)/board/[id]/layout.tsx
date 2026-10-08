import type { Metadata } from 'next'
import { getViewer } from '@/lib/supabase/viewer'

/** The topic's own title on the tab. Reads the way the page does: a guest
 *  gets the service-role client, so deleted topics are filtered explicitly. */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const { supabase, user } = await getViewer()
  if (!user) return {}
  const { data } = await supabase
    .from('topics')
    .select('title')
    .eq('id', id)
    .eq('is_deleted', false)
    .maybeSingle()
  return data?.title ? { title: data.title } : {}
}

export default function TopicLayout({ children }: { children: React.ReactNode }) {
  return children
}
