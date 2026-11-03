import { redirect } from 'next/navigation'

// The board is the front door; the pitch lives on /about. The proxy normally
// answers `/` first (and turns on guest mode for signed-out visitors); this
// covers local runs without Supabase, where the proxy steps aside.
export default function Home() {
  redirect('/board')
}
