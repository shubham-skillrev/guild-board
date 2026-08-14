'use client'

import { useState } from 'react'
import { CATEGORY_LABELS } from '@/lib/constants'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { UserAvatar } from '@/components/ui/UserAvatar'
import type { BankedIdea } from '@/types'

const CATEGORY_TONE = {
  deep_dive: 'indigo',
  discussion: 'matcha',
  blog_idea: 'wisteria',
  project_showcase: 'saffron',
} as const

interface IdeaCardProps {
  idea: BankedIdea
  /** False when no cycle is open - banking still works, promoting doesn't. */
  canPromote: boolean
  onPromote: (idea: BankedIdea) => void
  onToggleOpen?: (idea: BankedIdea) => void
  onDelete?: (idea: BankedIdea) => void
  /** Deletes the promoted topic and returns the idea to the bank. */
  onRemoveFromBoard?: (idea: BankedIdea) => void
}

export function IdeaCard({ idea, canPromote, onPromote, onToggleOpen, onDelete, onRemoveFromBoard }: IdeaCardProps) {
  const [busy, setBusy] = useState<null | 'promote' | 'open' | 'delete' | 'remove'>(null)
  const isPromoted = !!idea.promoted_topic_id
  const mine = idea.is_owner !== false

  const run = async (kind: 'promote' | 'open' | 'delete' | 'remove', fn?: (i: BankedIdea) => void) => {
    if (!fn) return
    setBusy(kind)
    try { await fn(idea) } finally { setBusy(null) }
  }

  return (
    <Card className="p-(--pad-card)">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          {/* The title leads. Labels sit under it in the metadata line rather
              than above it: a row of pills at the top of a card is the first
              thing the eye lands on, and none of it is what the card is about. */}
          <p className="text-[15px] font-semibold text-ink leading-snug">{idea.title}</p>

          {idea.note && (
            <p className="text-footnote text-ink-soft mt-1 leading-relaxed line-clamp-3">{idea.note}</p>
          )}

          <div className="flex items-center gap-1.5 flex-wrap mt-2">
            {idea.category && (
              <Badge tone={CATEGORY_TONE[idea.category]}>{CATEGORY_LABELS[idea.category]}</Badge>
            )}
            {idea.is_open && !isPromoted && <Badge tone="matcha">Up for grabs</Badge>}
            {isPromoted && <Badge tone="saffron">On the board</Badge>}
          </div>

          {/* Author shown only in the shared pool - your own bank is private. */}
          {!mine && (
            <div className="flex items-center gap-1.5 mt-2.5">
              {!idea.is_anonymous && <UserAvatar username={idea.author_username ?? 'user'} size={18} />}
              <span className="text-[11px] text-cha">
                {idea.is_anonymous ? '👻 a guild member' : `@${idea.author_username}`}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Actions sit a step quieter than the title. One accent action, the rest
          as plain text, so the row reads as a set of choices rather than as a
          toolbar bolted to the bottom of every card. */}
      <div className="flex items-center gap-1 mt-3 flex-wrap -ml-0.5">
        {!isPromoted && (
          <Button
            size="sm"
            variant="tinted"
            onClick={() => run('promote', onPromote)}
            disabled={!canPromote || busy !== null}
            title={canPromote ? undefined : 'Opens when the next cycle starts'}
          >
            {busy === 'promote' ? 'Pitching…' : mine ? 'Put on board' : 'I’ll take it'}
          </Button>
        )}

        {isPromoted && (
          <a
            href={`/board/${idea.promoted_topic_id}`}
            className="press inline-flex items-center h-6.5 px-2.5 pointer-coarse:h-10 pointer-coarse:px-3.5 text-[12px] pointer-coarse:text-footnote font-medium text-saffron hover:underline"
          >
            View on board
          </a>
        )}

        {/* A promoted idea used to offer nothing but a link. If the topic was
            then deleted the idea was stranded: the bank refused to delete it
            because it was "on the board", and the board no longer had it.
            Both exits are explicit now. */}
        {mine && isPromoted && onRemoveFromBoard && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => run('remove', onRemoveFromBoard)}
            disabled={busy !== null}
            title="Deletes the topic and returns this idea to your bank"
          >
            {busy === 'remove' ? 'Removing…' : 'Remove from board'}
          </Button>
        )}

        {mine && !isPromoted && onToggleOpen && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => run('open', onToggleOpen)}
            disabled={busy !== null}
          >
            {busy === 'open'
              ? 'Saving…'
              : idea.is_open
                ? 'Make private'
                : 'Offer to guild'}
          </Button>
        )}

        {mine && onDelete && (
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto"
            onClick={() => run('delete', onDelete)}
            disabled={busy !== null}
            title={
              isPromoted
                ? 'Removes the topic from the board and deletes the idea'
                : 'Deletes this idea'
            }
          >
            {busy === 'delete' ? 'Deleting…' : isPromoted ? 'Delete everywhere' : 'Delete'}
          </Button>
        )}
      </div>
    </Card>
  )
}
