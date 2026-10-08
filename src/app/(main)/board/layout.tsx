import type { Metadata } from 'next'

// The board pages are client components, so their title lives here.
// The template repeats the root one: a plain string here would drop it for
// the [id] page underneath.
export const metadata: Metadata = {
  title: { default: 'The Board', template: '%s \u00b7 GuildBoard' },
}

export default function BoardLayout({ children }: { children: React.ReactNode }) {
  return children
}
