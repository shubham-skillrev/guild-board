// ROUTE: /join?n=<first name> (public, no login)
// PURPOSE: The invite page: what the guild is, when it meets, what's on the
//          board, and one tap to join with Google. Linked from Kers' Slack
//          drafts for people without an account (?n= greets them by name),
//          and shareable as-is. Members are sent to the board.
// DB TABLES: (read) cycles, topics, demos, users via getGuildSnapshot

import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getGuildSnapshot } from '@/lib/guild/snapshot'
import { Wordmark } from '@/components/ui/Wordmark'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { Kers } from '@/components/kers/Kers'
import { GoogleSignIn } from '@/components/auth/GoogleSignIn'
import { GuildWelcome } from '@/components/welcome/GuildWelcome'

const SITE = process.env.NEXT_PUBLIC_APP_URL || 'https://guildboard.skillrev.in'
const TITLE = 'You’re invited to the SkillRev guild'
const DESCRIPTION = 'One hour a month: what we built, what broke, and what’s new in AI and tech. Devs, DevOps, QA, PMs and scrum masters all welcome.'

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { absolute: `${TITLE} · GuildBoard` },
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION },
  twitter: { card: 'summary', title: TITLE, description: DESCRIPTION },
}

type Props = { searchParams: Promise<{ n?: string | string[] }> }

export default async function JoinPage({ searchParams }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/board')

  const raw = (await searchParams).n
  // A first name for the greeting, nothing else: letters, spaces, a hyphen.
  const name = typeof raw === 'string' ? raw.replace(/[^\p{L}\s'-]/gu, '').trim().slice(0, 30) : ''
  const snapshot = await getGuildSnapshot()

  return (
    <div className="relative min-h-screen bg-parchment flex flex-col font-sans">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[560px] overflow-hidden">
        <div className="absolute inset-0 pattern-asanoha [mask-image:linear-gradient(to_bottom,black,transparent)]" />
        <div className="absolute inset-0 glow-saffron" />
      </div>

      <header className="sticky top-0 z-(--z-chrome) material-chrome border-b border-border">
        <div className="flex items-center justify-between h-16 px-(--pad-page-x) max-w-(--measure-wide) mx-auto">
          <Link href="/about" aria-label="About GuildBoard"><Wordmark /></Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="relative flex-1 px-(--pad-page-x) pt-10 pb-20 md:pt-16">
        <div className="mx-auto grid max-w-(--measure-wide) gap-10 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:gap-16">
          <section className="min-w-0 lg:sticky lg:top-28 lg:self-start">
            <Kers size={112} expression="excited" colour="proud" follow />
            <p className="eyebrow mt-6">An invitation</p>
            <h1 className="mt-3 text-[2.25rem] sm:text-[2.75rem] font-semibold leading-[1.04] tracking-[-0.04em] text-ink text-balance">
              {name ? `${name}, you’re` : 'You’re'} invited to the <span className="font-serif italic font-normal">guild</span>.
            </h1>
            <p className="mt-5 text-[15px] leading-relaxed text-ink-soft">{DESCRIPTION}</p>
            <p className="mt-2 text-footnote text-ink-muted">
              {snapshot.members} people at SkillRev are already in. Joining takes one tap with your SkillRev Google account.
            </p>
            <div className="mt-7 space-y-3">
              <GoogleSignIn label="Join with Google" />
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-footnote">
                <Link href="/survey" className="text-ink underline decoration-border-strong underline-offset-2 hover:decoration-ink">Answer the 2-minute survey first</Link>
                <Link href="/" className="text-ink-muted hover:text-ink">Just look around</Link>
              </div>
            </div>
          </section>

          <section aria-label="The guild this month" className="min-w-0 elev-2 rounded-[20px] p-5 sm:p-8">
            <GuildWelcome snapshot={snapshot} />
          </section>
        </div>
      </main>
    </div>
  )
}
