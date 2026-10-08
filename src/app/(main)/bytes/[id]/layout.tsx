import type { Metadata } from 'next'
import { getViewer } from '@/lib/supabase/viewer'

/** The story's headline on the tab. Only stories in a published digest,
 *  matching what /api/bytes/[id] will serve. */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const { supabase, user } = await getViewer()
  if (!user) return {}
  const { data } = await supabase
    .from('bytes')
    .select('source_title, byte_digests!inner(status)')
    .eq('id', id)
    .eq('byte_digests.status', 'published')
    .maybeSingle()
  return data?.source_title ? { title: data.source_title } : {}
}

export default function ByteLayout({ children }: { children: React.ReactNode }) {
  return children
}
