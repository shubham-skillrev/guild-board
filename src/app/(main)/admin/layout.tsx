import { notFound } from 'next/navigation'
import { getStaff } from '@/lib/guild/staff'
import { AdminTabs } from '@/components/admin/AdminTabs'

/**
 * The control room. Admins get every tab; a viewer gets the analytics tabs
 * read-only (no Run). Everyone else gets the same 404 the proxy gives, so
 * the page doesn't confirm it exists.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const staff = await getStaff()
  if (!staff) notFound()

  return (
    <div className="px-(--pad-page-x) pt-6 w-full max-w-(--measure-wide) mx-auto pb-28 md:pb-10">
      <p className="eyebrow print:hidden">{staff.readOnly ? 'Control room · view only' : 'Control room'}</p>
      <div className="mt-3">
        <AdminTabs readOnly={staff.readOnly} />
      </div>
      <div className="pt-8">{children}</div>
    </div>
  )
}
