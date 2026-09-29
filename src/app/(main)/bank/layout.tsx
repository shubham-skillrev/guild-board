import { redirect } from 'next/navigation'

/**
 * The idea bank is retired from the product: one board, one way to post.
 * Its page redirects so old links and bookmarks still land somewhere useful.
 * The data and the /api/idea-bank routes are left in place, untouched.
 */
export default function BankLayout() {
  redirect('/board')
}
