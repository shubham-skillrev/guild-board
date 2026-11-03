import Link from 'next/link'
import { Kers } from '@/components/kers/Kers'
import type { MyYear } from '@/lib/guild/myYear'

/** Your year in the guild, with Kers' take on it. Only you see this. */
export function MyYearCard({ year, line }: { year: MyYear; line: string }) {
  const stats = [
    ['Days here', year.daysHere],
    ['Posts', year.posts],
    ['Comments', year.comments],
    ['Votes', year.votes],
    ['Sparks given', year.sparksGiven],
    ['Show & Tell', year.demos],
  ] as const
  return (
    <section aria-labelledby="my-year" className="mb-8 rounded-[20px] border border-border bg-paper p-5 sm:p-6">
      <div className="flex items-start gap-4">
        <Kers size={72} expression="smug" follow className="shrink-0" />
        <div className="min-w-0">
          <h2 id="my-year" className="eyebrow">Your {year.year} in the guild · only you see this</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-ink">{line}</p>
        </div>
      </div>
      <dl className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-6">
        {stats.map(([label, n]) => (
          <div key={label} className="rounded-(--radius-control) bg-kinu/40 px-3 py-2.5">
            <dt className="text-meta text-ink-muted">{label}</dt>
            <dd className="mt-1 text-[20px] leading-none font-semibold text-ink tabular">{n}</dd>
          </div>
        ))}
      </dl>
      {!year.answeredSurvey && (
        <p className="mt-4 text-footnote text-ink-soft">
          You haven’t answered the guild survey yet. <Link href="/survey" className="text-ink underline underline-offset-2">Two minutes →</Link>
        </p>
      )}
    </section>
  )
}
