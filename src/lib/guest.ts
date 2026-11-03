/**
 * Guest mode: a signed-out visitor can look around every member page without
 * being able to change anything.
 *
 * It is a cookie, not an account. There is no Supabase session behind it, and
 * the RLS policies only ever answer `authenticated`, so guest reads go through
 * the server (see `getViewer`) and every write is refused in the proxy before
 * it reaches a handler.
 *
 * Kept free of server-only imports so the proxy can share the constants.
 */
export const GUEST_COOKIE = 'gb_guest'

/** One week, read-only. Shared by "Look around as a guest" and the proxy,
 *  which turns it on for signed-out visitors arriving at `/`. */
export const GUEST_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: 60 * 60 * 24 * 7,
}

/** Stands in for `user.id` on guest reads. Matches no row, so "what have I
 *  voted for" style queries come back empty instead of needing a branch. */
export const GUEST_USER_ID = '00000000-0000-0000-0000-000000000000'

export const GUEST_READ_ONLY_ERROR = 'Guest mode is read-only. Sign in to take part.'

/** Member pages a guest still cannot open: nothing to show without an account,
 *  or nothing a guest should see at all. */
export const GUEST_BLOCKED_PAGES = ['/admin', '/profile', '/notifications']
