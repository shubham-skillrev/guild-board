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
  /** False when no cycle is open — banking still works, promoting doesn't. */
  canPromote: boolean
  onPromote: (idea: BankedIdea) => void
  onToggleOpen?: (idea: BankedIdea) => void
  onDelete?: (idea: BankedIdea) => void
}

export function IdeaCard({ idea, canPromote, onPromote, onToggleOpen, onDelete }: IdeaCardProps) {
  const [busy, setBusy] = useState<null | 'promote' | 'open' | 'delete'>(null)
  const isPromoted = !!idea.promoted_topic_id
  const mine = idea.is_owner !== false

  const run = async (kind: 'promote' | 'open' | 'delete', fn?: (i: BankedIdea) => void) => {
    if (!fn) return
    setBusy(kind)
    try { await fn(idea) } finally { setBusy(null) }
  }

  return (
    <Card className="p-3.5 sm:p-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            {idea.category && (
              <Badge tone={CATEGORY_TONE[idea.category]}>{CATEGORY_LABELS[idea.category]}</Badge>
            )}
            {idea.is_open && !isPromoted && <Badge tone="matcha">🙌 Up for grabs</Badge>}
            {isPromoted && <Badge tone="saffron">★ On the board</Badge>}
          </div>

          <p className="text-[14px] font-medium text-ink leading-snug">{idea.title}</p>

          {idea.note && (
            <p className="text-[12px] text-ink-soft mt-1.5 leading-relaxed line-clamp-3">{idea.note}</p>
          )}

          {/* Author shown only in the shared pool — your own bank is private. */}
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

      <div className="flex items-center gap-2 mt-3.5 flex-wrap">
        {!isPromoted && (
          <Button
            size="sm"
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
            className="text-[12px] text-saffron hover:underline"
          >
            View on board →
          </a>
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

        {mine && !isPromoted && onDelete && (
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto"
            onClick={() => run('delete', onDelete)}
            disabled={busy !== null}
          >
            {busy === 'delete' ? 'Deleting…' : 'Delete'}
          </Button>
        )}
      </div>
    </Card>
  )
}
