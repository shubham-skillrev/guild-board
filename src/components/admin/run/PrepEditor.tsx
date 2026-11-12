'use client'

import { useState } from 'react'
import { CaretDown, Sparkle, X } from '@phosphor-icons/react/dist/ssr'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { Input } from '@/components/ui/Input'
import { cn } from '@/lib/utils/cn'
import { LIMITS, type Prep, type Segment } from '@/lib/meeting'

export interface BoardPost {
  id: string
  title: string
}

function status(prep: Prep | null | undefined): string {
  if (!prep) return 'not drafted yet'
  const empty = !prep.points.length && !prep.opener
  if (prep.by === 'admin') return empty ? 'cleared by an admin' : 'edited'
  return empty ? 'Kers couldn’t draft this one' : 'drafted by Kers'
}

/**
 * One segment's Kers' prep in the Run tab: the board posts it's about, the
 * opener and up to three talking points. Kers drafts them (from the posts,
 * their comments and votes); any edit here makes the prep the admin's, so
 * Kers never redrafts over it unless "Redraft" is pressed.
 */
export function PrepEditor({
  segment,
  posts,
  onChange,
  onRedraft,
  redraftDisabled,
  redrafting,
}: {
  segment: Segment
  posts: BoardPost[]
  onChange: (patch: Partial<Segment>) => void
  onRedraft: () => void
  /** Unsaved edits: redrafting would throw them away. */
  redraftDisabled: boolean
  redrafting: boolean
}) {
  const [open, setOpen] = useState(false)
  const prep = segment.prep ?? null
  const points = [...(prep?.points ?? [])]
  while (points.length < LIMITS.points) points.push('')
  const linked = segment.topicIds ?? []
  const byId = new Map(posts.map(p => [p.id, p]))

  const edit = (patch: Partial<Prep>) => {
    const next: Prep = { points: prep?.points ?? [], opener: prep?.opener ?? '', at: prep?.at ?? null, ...patch, by: 'admin' }
    onChange({ prep: next })
  }
  const setPoint = (i: number, v: string) => {
    const next = [...points]
    next[i] = v
    // Empty lines are dropped when it's saved.
    edit({ points: next })
  }

  return (
    <div className="rounded-(--radius-control) bg-sumi/60">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-meta text-ink-muted hover:text-ink"
      >
        <Icon icon={Sparkle} size="sm" />
        <span className="font-medium text-ink-soft">Kers’ prep</span>
        <span>· {status(prep)}{linked.length ? ` · ${linked.length} post${linked.length === 1 ? '' : 's'}` : ''}</span>
        <Icon icon={CaretDown} size="sm" className={cn('ml-auto transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="space-y-2.5 px-3 pb-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {linked.map(id => (
              <span key={id} className="inline-flex h-8 max-w-full items-center gap-1 rounded-full bg-paper pl-3 pr-1 text-footnote text-ink-soft">
                <span className="truncate">{byId.get(id)?.title ?? 'A post that’s gone'}</span>
                <button
                  type="button"
                  aria-label="Unlink post"
                  onClick={() => onChange({ topicIds: linked.filter(x => x !== id) })}
                  className="press-sm rounded-full p-1 text-ink-muted hover:text-ink"
                >
                  <Icon icon={X} size="sm" />
                </button>
              </span>
            ))}
            {linked.length < LIMITS.topics && posts.length > 0 && (
              <select
                aria-label="Link a board post"
                value=""
                onChange={e => e.target.value && onChange({ topicIds: [...linked, e.target.value] })}
                className="h-8 max-w-[16rem] rounded-full border border-border bg-paper px-3 text-footnote text-ink-muted"
              >
                <option value="">Link a board post…</option>
                {posts.filter(p => !linked.includes(p.id)).map(p => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            )}
          </div>

          <Input aria-label="Opener" placeholder="Opener: one line or question to start with" maxLength={LIMITS.opener} value={prep?.opener ?? ''} onChange={e => edit({ opener: e.target.value })} />
          {points.map((p, i) => (
            <Input key={i} aria-label={`Talking point ${i + 1}`} placeholder={`Talking point ${i + 1}`} maxLength={LIMITS.point} value={p} onChange={e => setPoint(i, e.target.value)} />
          ))}

          <div className="flex items-center gap-2">
            <Button variant="secondary" icon={Sparkle} disabled={redraftDisabled || redrafting} onClick={onRedraft}>
              {redrafting ? 'Drafting…' : prep ? 'Redraft' : 'Draft'}
            </Button>
            <p className="text-meta text-ink-muted">
              {redraftDisabled ? 'Save first, then Kers can redraft.' : 'Redrafting replaces this, edits included.'}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
