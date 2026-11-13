import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { GUEST_BLOCKED_PAGES, GUEST_COOKIE, GUEST_COOKIE_OPTIONS, GUEST_READ_ONLY_ERROR } from '@/lib/guest'
import { REHEARSAL_CODE_RE, REHEARSAL_COOKIE, REHEARSAL_COOKIE_MAX_AGE } from '@/lib/meet/liveRehearsal'

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
    pathname === '/api/me/next' ||
    // The invite page: for people who haven't joined yet.
    pathname === '/join' ||
    // Meeting mode's room: guests join with a typed name, no account. The
    // API recognises members by session and guests by their own cookie, and
    // only lets anyone in while the meeting is live. /meet/present is not
    // in here: it stays admin-only.
    pathname === '/meet' ||
    pathname === '/api/meet' ||
    pathname === '/api/meet/live' ||
    // The meeting mock: fake data, nothing written, 404 in production.
    (process.env.NODE_ENV !== 'production' && pathname === '/meet/mock') ||
    pathname === '/favicon.ico' ||
    isPwaAsset

  // A live rehearsal's link, /meet?r=<code>: keep the code in an httpOnly
  // cookie and drop it from the address bar. Whether it's the running
  // rehearsal's code is /api/meet's question (lib/meet/liveRehearsal.ts).
  if (pathname === '/meet' && request.nextUrl.searchParams.has('r')) {
    const code = request.nextUrl.searchParams.get('r') ?? ''
    const clean = request.nextUrl.clone()
    clean.searchParams.delete('r')
    const res = NextResponse.redirect(clean)
    if (REHEARSAL_CODE_RE.test(code)) {
      res.cookies.set(REHEARSAL_COOKIE, code, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: REHEARSAL_COOKIE_MAX_AGE })
    }
    return res
  }

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

  // getClaims verifies the session JWT locally against the project's cached
  // public key (ES256), and only goes to Supabase Auth when the token needs
  // refreshing. getUser made a network round trip on every request, pages,
  // RSC prefetches and every API call alike, before any real work started.
  const { data: claimsData } = await supabase.auth.getClaims()
  const user = claimsData?.claims?.sub ? { id: claimsData.claims.sub } : null

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
  // Viewers (migration 043) may see the analytics tabs read-only, never Run.
  if (pathname.startsWith('/admin') && user) {
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    const viewerOk = userData?.role === 'viewer' && !pathname.startsWith('/admin/run')
    if (userData?.role !== 'admin' && !viewerOk) {
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
