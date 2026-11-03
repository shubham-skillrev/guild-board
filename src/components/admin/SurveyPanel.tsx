import Link from 'next/link'
import { ArrowRight } from '@phosphor-icons/react/dist/ssr'
import { SectionHeader } from '@/components/ui/Section'
import type { SurveyRow } from '@/lib/surveyResults'

/**
 * The guild survey at a glance, in the admin rail. The full results, filters
 * and exports live on /admin/survey.
 */
export function SurveyPanel({ rows }: { rows: SurveyRow[] }) {
  const newVoices = rows.filter(r => !r.member).length
  const couldDemo = rows.filter(r => r.demo === 'yes' || r.demo === 'maybe').length

  return (
    <section aria-labelledby="admin-survey">
      <SectionHeader id="admin-survey" title="Survey results" hint="Answers to guildboard.skillrev.in/survey" />
      <Link
        href="/admin/survey"
        className="press group block rounded-(--radius-card) border border-border bg-paper px-4 py-3.5 hover:border-border-strong transition-colors"
      >
        <p className="flex items-baseline gap-2">
          <span className="text-[26px] leading-none font-semibold tracking-tight text-ink">{rows.length}</span>
          <span className="text-footnote text-ink-muted">{rows.length === 1 ? 'answer' : 'answers'}</span>
        </p>
        <p className="mt-2 text-footnote text-ink-soft">
          {rows.length
            ? `${newVoices} without an account · ${couldDemo} could show something`
            : 'None yet. Share the link in Slack.'}
        </p>
        <p className="mt-3 inline-flex items-center gap-1 text-footnote text-ink group-hover:underline">
          Open results
          <ArrowRight className="w-3.5 h-3.5" aria-hidden />
        </p>
      </Link>
    </section>
  )
}
