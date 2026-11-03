// ROUTE: /survey (public, no login)
// PURPOSE: The guild survey: what would make people at SkillRev come to the
//          monthly meeting, who would show something, who deserves the
//          Spotlight. Anyone can answer with a name and @skillrev.dev email;
//          "Fill with Google" signs them up and fills both in.
// DB TABLES: survey_responses, users (read here only for a signed-in viewer)

import type { Metadata } from 'next'
import Link from 'next/link'
import { Wordmark } from '@/components/ui/Wordmark'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { SurveyForm, type SurveyViewer } from '@/components/survey/SurveyForm'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { EMPTY_ANSWERS, SURVEY_KEY, type SurveyAnswers } from '@/lib/survey'
import { isAllowedEmailDomain } from '@/lib/utils/email'

const SITE = process.env.NEXT_PUBLIC_APP_URL || 'https://guildboard.skillrev.in'
const TITLE = 'What would make the guild worth your hour?'
const DESCRIPTION = 'Two minutes, seven questions. Help shape the SkillRev guild meeting, for devs, DevOps, QA, PMs and scrum masters alike.'

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { absolute: 'Guild survey · GuildBoard' },
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION },
  twitter: { card: 'summary', title: TITLE, description: DESCRIPTION },
}

/** The signed-in person and their earlier answer, if any. */
async function getViewer(): Promise<{ viewer: SurveyViewer | null; initial: SurveyAnswers | null; answeredAt: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email || !isAllowedEmailDomain(user.email)) return { viewer: null, initial: null, answeredAt: null }

  const admin = createAdminClient()
  const [{ data: profile }, { data: answer }] = await Promise.all([
    admin.from('users').select('real_name, username').eq('id', user.id).maybeSingle(),
    admin
      .from('survey_responses')
      .select('*')
      .eq('survey', SURVEY_KEY)
      .eq('email', user.email.toLowerCase())
      .maybeSingle(),
  ])

  const name = profile?.real_name || (user.user_metadata?.full_name as string | undefined) || ''
  const viewer: SurveyViewer = {
    name,
    email: user.email.toLowerCase(),
    // First sign-in leaves a temporary handle until they pick one on the board.
    needsUsername: !profile?.username || profile.username.startsWith('user_'),
  }

  if (!answer) return { viewer, initial: null, answeredAt: null }

  const initial: SurveyAnswers = {
    ...EMPTY_ANSWERS,
    name: answer.name,
    email: answer.email,
    role: answer.role,
    attended: answer.attended,
    join_reasons: answer.join_reasons ?? [],
    join_other: answer.join_other ?? '',
    learn_next: answer.learn_next ?? '',
    demo: answer.demo,
    demo_idea: answer.demo_idea ?? '',
    nominee_name: answer.nominee_name ?? '',
    nominee_why: answer.nominee_why ?? '',
    meeting_slot: answer.meeting_slot,
  }
  return { viewer, initial, answeredAt: answer.updated_at }
}

export default async function SurveyPage() {
  const { viewer, initial, answeredAt } = await getViewer()

  return (
    <div className="relative min-h-screen bg-parchment flex flex-col font-sans">
      {/* The page's one decoration: the landing page's warm bloom over a
          dot grid that fades out as you scroll into the form. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[640px] overflow-hidden">
        <div className="absolute inset-0 pattern-asanoha [mask-image:linear-gradient(to_bottom,black,transparent)]" />
        <div className="absolute inset-0 glow-saffron" />
      </div>

      <header className="sticky top-0 z-(--z-chrome) material-chrome border-b border-border">
        <div className="flex items-center justify-between h-16 px-(--pad-page-x) max-w-(--measure-wide) mx-auto">
          <Link href="/" aria-label="GuildBoard by SkillRev, home">
            <Wordmark />
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="relative flex-1 px-(--pad-page-x) pt-10 pb-20 md:pt-16">
        <SurveyForm viewer={viewer} initial={initial} answeredAt={answeredAt} />
      </main>

      <footer className="relative border-t border-border px-(--pad-page-x) py-6 text-center text-caption text-ink-muted">
        The SkillRev engineering guild · meets once a month, open to every role
      </footer>
    </div>
  )
}
