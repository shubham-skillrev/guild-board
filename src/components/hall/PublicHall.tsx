'use client'

import { useState } from 'react'
import { X } from '@phosphor-icons/react/dist/ssr'
import { HeartHall } from '@/components/hall/HeartHall'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { Icon } from '@/components/ui/Icon'
import { SparkButton } from '@/components/voting/SparkButton'
import type { PublicWindow } from '@/lib/guild/publicHall'

const LIT_LABEL = { driving: 'Lighting the way', regular: 'Glowing', showing_up: 'Lit', quiet: 'Not lit yet' } as const

export interface SparkWindow {
  cycleId: string
  sparkedUserId: string | null
  currentUserId: string
}

/**
 * The guild as a heart everyone can see: members are bigger and nearer the
 * middle the more they've done under their name; new members are ringed and
 * this month's presenters carry a mic. Pick someone to see what they've done (and
 * spark them, while the spark window is open).
 */
export function PublicHall({ windows, spark }: { windows: PublicWindow[]; spark: SparkWindow | null }) {
  const [picked, setPicked] = useState<string | null>(null)
  const pick = windows.find(w => w.key === picked) ?? null
  const newCount = windows.filter(w => w.isNew).length
  const you = windows.find(w => w.isYou)

  return (
    <section aria-labelledby="hall-title">
      <h2 id="hall-title" className="sr-only">The guild</h2>
      <HeartHall
        items={windows.map(w => ({
          key: w.key,
          level: w.level,
          seed: w.username,
          name: `@${w.username}`,
          label: `@${w.username}${w.isYou ? ' (you)' : ''}${w.isNew ? ', new' : ''}${w.presenting ? ', presenting this month' : ''}: ${LIT_LABEL[w.level]}`,
          selected: picked === w.key,
          you: w.isYou,
          isNew: w.isNew,
          presenting: w.presenting,
          onClick: () => setPicked(picked === w.key ? null : w.key),
        }))}
      />
      <p className="mt-3 text-center text-meta text-ink-muted">
        {windows.length} members{newCount ? ` · ${newCount} new (ringed)` : ''}. The bigger and nearer the middle, the more someone’s done for the guild. Pick anyone to see what.
      </p>

      {you && you.level === 'quiet' && (
        <p className="mt-3 rounded-(--radius-card) border border-border bg-paper px-4 py-3 text-footnote text-ink-soft">
          You’re near the edge of the heart for now. One comment, one topic, or one Radar link moves you in.
        </p>
      )}

      {pick && (
        <div className="mt-4 rounded-[20px] border border-border bg-paper p-5" aria-live="polite">
          <div className="flex items-start gap-4">
            <UserAvatar username={pick.username ?? ''} size={48} />
            <div className="min-w-0 flex-1">
              <p className="text-[17px] font-semibold text-ink">@{pick.username}{pick.isYou ? ' · you' : ''}</p>
              <p className="text-meta text-ink-muted">{LIT_LABEL[pick.level]} · guild score {pick.stats.score}</p>
            </div>
            <button type="button" onClick={() => setPicked(null)} aria-label="Close" className="press p-1 text-ink-muted hover:text-ink"><Icon icon={X} size="sm" /></button>
          </div>
          <dl className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {([
              ['Sparks', pick.stats.sparks],
              ['Topics', pick.stats.topics],
              ['Picked', pick.stats.picked],
              ['Comments', pick.stats.comments],
              ['Show & Tell', pick.stats.demos],
              ['Radar', pick.stats.radar],
            ] as const).map(([label, n]) => (
              <div key={label} className="rounded-(--radius-control) bg-kinu/40 px-3 py-2">
                <dt className="text-meta text-ink-muted">{label}</dt>
                <dd className="mt-0.5 text-[18px] font-semibold leading-none text-ink tabular">{n}</dd>
              </div>
            ))}
          </dl>
          {spark && pick.userId && pick.userId !== spark.currentUserId && (
            <div className="mt-4 flex items-center gap-3 border-t border-border pt-4">
              <p className="min-w-0 flex-1 text-footnote text-ink-soft">Did @{pick.username} make this month better?</p>
              <SparkButton
                key={pick.userId}
                toUserId={pick.userId}
                cycleId={spark.cycleId}
                alreadyGiven={spark.sparkedUserId === pick.userId}
                isDisabled={spark.sparkedUserId !== null && spark.sparkedUserId !== pick.userId}
              />
            </div>
          )}
        </div>
      )}
    </section>
  )
}
