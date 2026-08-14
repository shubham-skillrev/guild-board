'use client'

/**
 * Who is carrying this cycle, derived from the topics already on screen.
 *
 * Deliberately not a fetch. The board was already making five requests from
 * four components, and everything this needs is in the topic list it sits
 * beside. It also means the rail can never disagree with the board.
 *
 * Ghost topics are excluded rather than credited to their handle. Crediting
 * them would let anyone work backwards from the arithmetic to the author,
 * which is the same reason they are left out of cycle scoring.
 */

import Link from 'next/link'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { SectionHeader } from '@/components/ui/Section'
import type { Topic } from '@/types'

interface Contributor {
  username: string
  topics: number
  score: number
}

function rank(topics: Topic[]): Contributor[] {
  const by = new Map<string, Contributor>()

  for (const t of topics) {
    if (t.is_anonymous) continue
    const username = t.author_username
    if (!username) continue

    const entry = by.get(username) ?? { username, topics: 0, score: 0 }
    entry.topics += 1
    entry.score += t.vote_count + t.contrib_count * 2
    by.set(username, entry)
  }

  return [...by.values()]
    .filter(c => c.score > 0)
    .sort((a, b) => b.score - a.score || a.username.localeCompare(b.username))
    .slice(0, 5)
}

export function TopContributors({ topics }: { topics: Topic[] }) {
  const contributors = rank(topics)

  // Nothing scored yet means the list would only report who is absent.
  if (contributors.length === 0) return null

  return (
    <section aria-labelledby="board-contributors">
      <SectionHeader id="board-contributors" title="Carrying this cycle" />
      <ul className="rounded-(--radius-card) border border-border bg-paper/40 divide-y divide-border overflow-hidden">
        {contributors.map(c => (
          <li key={c.username}>
            <Link
              href={`/leaderboard`}
              className="press flex items-center gap-2.5 px-3.5 py-2.5 min-h-11 hover:bg-kinu/30 transition-colors"
            >
              <UserAvatar username={c.username} size={22} />
              <span className="text-footnote text-ink truncate flex-1 min-w-0">@{c.username}</span>
              <span className="text-meta text-ink-muted tabular shrink-0">
                {c.topics} {c.topics === 1 ? 'idea' : 'ideas'}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
