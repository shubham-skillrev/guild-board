import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { GUEST_BLOCKED_PAGES, GUEST_COOKIE, GUEST_COOKIE_OPTIONS, GUEST_READ_ONLY_ERROR } from '@/lib/guest'

const isSupabaseConfigured = !!(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
)

export async function proxy(request: NextRequest) {
  // Skip auth enforcement if Supabase is not configured (local dev without env vars)
  if (!isSupabaseConfigured) return NextResponse.next()

  const { pathname } = request.nextUrl

  // Public routes - pass through without auth check
  const isPwaAsset =
    pathname === '/manifest.webmanifest' ||
    pathname === '/sw.js' ||
    pathname === '/icon.svg' ||
    pathname === '/icon-maskable.svg' ||
    pathname.startsWith('/icon-') ||
    pathname === '/apple-touch-icon.png'

  const isPublicRoute =
    pathname.startsWith('/api/auth') ||
    // Cron has no user session. It authenticates with a shared secret inside
    // the route itself, so skipping the session check here is required, not a
    // hole: an unauthenticated request still gets a 404 from the handler.
    pathname.startsWith('/api/cron') ||
    pathname.startsWith('/_next') ||
    pathname === '/about' ||
    pathname === '/login' ||
    // The guild building, every hour (public, a story with no live data).
    pathname === '/hours' ||
    pathname.startsWith('/hours/') ||
    // The guild survey: answered by people without an account too. The API
    // checks the email domain itself and writes only with the service role.
    pathname === '/survey' ||
    pathname === '/api/survey' ||
    pathname === '/api/survey/status' ||
    pathname === '/favicon.ico' ||
    isPwaAsset

  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // The board is the front door. Members land on it; anyone signed out sees
  // it read-only in guest mode (the pitch lives on /about). Set on the
  // redirect itself, so the very first board render is already a guest one.
  if (pathname === '/') {
    const res = NextResponse.redirect(new URL('/board', request.url))
    if (!user && request.cookies.get(GUEST_COOKIE)?.value !== '1') {
      res.cookies.set(GUEST_COOKIE, '1', GUEST_COOKIE_OPTIONS)
    }
    return res
  }

  // Guest mode - read-only browsing without a session. Pages load; the API
  // answers reads only. Page POSTs are server actions, which check auth
  // themselves (and include leaving guest mode), so they pass.
  const isGuest = !user && request.cookies.get(GUEST_COOKIE)?.value === '1'
  if (isGuest && !isPublicRoute) {
    if (GUEST_BLOCKED_PAGES.some(p => pathname === p || pathname.startsWith(`${p}/`))) {
      return pathname.startsWith('/admin')
        ? new NextResponse(null, { status: 404 })
        : NextResponse.redirect(new URL('/login', request.url))
    }
    if (pathname.startsWith('/api/admin')) {
      return new NextResponse(null, { status: 404 })
    }
    if (pathname.startsWith('/api') && request.method !== 'GET' && request.method !== 'HEAD') {
      return NextResponse.json({ error: GUEST_READ_ONLY_ERROR }, { status: 403 })
    }
    return response
  }

  // Unauthenticated - redirect to login (except public routes)
  if (!user && !isPublicRoute) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Admin route - return 404 for non-admins (do NOT redirect - 404 hides existence).
  // /admin itself is also a team lead's view of their team, so it passes here
  // and the page checks admin-or-lead itself (with the same 404).
  if (pathname.startsWith('/admin') && pathname !== '/admin' && user) {
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (userData?.role !== 'admin') {
      return new NextResponse(null, { status: 404 })
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/auth|manifest.webmanifest|sw.js|icon-|apple-touch-icon|icon.svg|icon-maskable.svg).*)',
  ],
}
