import { Suspense } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { LogoutButton } from '@/components/layout/LogoutButton'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { DesktopNavLinks, MobileBottomNav } from '@/components/layout/NavLinks'
import { UsernameSetupModal } from '@/components/auth/UsernameSetupModal'

async function getUser() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data } = await supabase
      .from('users')
      .select('username, role')
      .eq('id', user.id)
      .single()
    return data
  } catch {
    return null
  }
}

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const profile = await getUser()

  return (
    <div className="min-h-screen bg-parchment flex flex-col overflow-x-hidden">
      <Suspense fallback={null}>
        <UsernameSetupModal />
      </Suspense>

      {/* ─── Top bar — clean Peerlist-style nav ─── */}
      <header className="bg-paper/80 backdrop-blur-xl border-b border-border sticky top-0 z-30">
        <div className="flex items-center justify-between px-5 md:px-10 h-14 w-full max-w-7xl mx-auto">
          {/* Left: Logo + Nav */}
          <div className="flex items-center gap-7">
            <Link href="/board" className="flex items-center gap-2.5 group">
              <span className="text-saffron text-base leading-none transition-transform group-hover:scale-110">◈</span>
              <span className="font-serif font-semibold text-ink text-base tracking-tight">
                GuildBoard
              </span>
            </Link>
            <DesktopNavLinks role={profile?.role} />
          </div>

          {/* Right: Profile + Logout */}
          <div className="flex items-center gap-2">
            {profile && (
              <Link
                href="/profile"
                className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[13px] text-ink-soft hover:bg-kinu transition-all group"
              >
                <span className="w-7 h-7 rounded-full overflow-hidden border border-border-strong group-hover:border-saffron/40 transition-colors">
                  <UserAvatar username={profile.username ?? 'user'} size={28} />
                </span>
                <span className="hidden sm:inline text-ink font-medium">@{profile.username}</span>
              </Link>
            )}
            <LogoutButton />
          </div>
        </div>
      </header>

      {/* ─── Main content ─── */}
      <main className="flex-1 min-w-0 w-full pb-24 sm:pb-0">
        {children}
      </main>

      {/* Mobile bottom nav */}
      <MobileBottomNav role={profile?.role} username={profile?.username} />

      {/* ─── Footer ─── */}
      <footer className="hidden sm:block border-t border-border px-5 py-5 mt-auto">
        <p className="text-[11px] text-cha text-center tracking-wider uppercase">
          GuildBoard <span className="mx-1.5 text-border-strong">·</span> Crafted for builders
        </p>
      </footer>
    </div>
  )
}

