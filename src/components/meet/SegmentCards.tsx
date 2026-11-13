'use client'

import { ArrowUpRight, Newspaper } from '@phosphor-icons/react/dist/ssr'
import { Icon } from '@/components/ui/Icon'
import { TOPIC_CARD_CLASS, TopicCardCounts, TopicCardHead } from '@/components/topics/TopicCard'
import { cn } from '@/lib/utils/cn'
import { isRealCard, type Card, type MeetPost } from '@/lib/meeting'

/**
 * A slide's content (lib/meeting.ts Card), on the shared screen and every
 * phone. Only real content is a card: a Radar item (news) and a board post,
 * which is the board's own card (TopicCardHead), not a lookalike. Summary is
 * plain text (SlideText): a debate's sides in two columns, notes as a
 * compact list. The one saffron accent stays the presenter's button.
 *
 *   screen   a grid, 1-4 across, big type for a shared screen
 *   strip    one compact row
 *   phone    one column; news opens its source, a post its board page,
 *            both in a new tab so the room stays open
 */

export type CardsSize = 'screen' | 'strip' | 'phone'

type Tone = 'indigo' | 'neutral'

/** Tint, edge and ink per tone: pastel on paper, the token's own hue for the eyebrow. */
const TONES: Record<Tone, { card: string; ink: string; chip: string }> = {
  indigo: { card: 'bg-indigo-jp/[0.07] border-indigo-jp/20 dark:bg-indigo-jp/[0.1]', ink: 'text-indigo-jp', chip: 'bg-indigo-jp/12 text-indigo-jp' },
  neutral: { card: 'bg-paper border-border', ink: 'text-ink-muted', chip: 'bg-fill text-ink-muted' },
}

const host = (url?: string) => {
  if (!url) return ''
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

/** Grid columns for n cards on the shared screen: one row up to four, else rows of three. */
function columns(n: number): number {
  return n <= 4 ? Math.max(1, n) : 3
}

export function SegmentCards({ cards, posts, size, className }: { cards: Card[]; posts: Record<string, MeetPost>; size: CardsSize; className?: string }) {
  // Real content only; a post card whose post is gone (deleted, another month) just isn't shown.
  const shown = cards.filter(isRealCard).filter(c => c.kind !== 'post' || posts[c.postId])
  if (!shown.length) return null
  const tone: Tone[] = shown.map(c => (c.kind === 'news' ? 'indigo' : 'neutral'))

  if (size === 'strip') {
    return (
      <ul aria-label="On this segment" className={cn('flex min-w-0 gap-2.5 overflow-hidden', className)}>
        {shown.map((c, i) => (
          <li key={i} className={cn('flex h-10 min-w-0 max-w-[22rem] shrink items-center gap-2 rounded-full border px-4 text-[15px]', TONES[tone[i]].card)}>
            <span aria-hidden className={cn('size-2 shrink-0 rounded-full bg-current', TONES[tone[i]].ink)} />
            <span className="truncate text-ink-soft">{stripLabel(c, posts)}</span>
          </li>
        ))}
      </ul>
    )
  }

  const screen = size === 'screen'
  const cols = columns(shown.length)
  return (
    <ul
      aria-label="On this segment"
      className={cn('stagger-children grid', screen ? 'gap-5' : 'gap-3 @3xl:grid-cols-2 @3xl:gap-4', className)}
      style={screen ? { gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` } : undefined}
    >
      {shown.map((c, i) => (
        <li key={`${c.kind}-${i}`} className="flex min-w-0">
          <CardView card={c} tone={tone[i]} posts={posts} screen={screen} dense={screen && cols >= 4} shownCount={shown.length} />
        </li>
      ))}
    </ul>
  )
}

function stripLabel(c: Extract<Card, { kind: 'news' | 'post' }>, posts: Record<string, MeetPost>): string {
  return c.kind === 'news' ? c.title : posts[c.postId]?.title ?? ''
}

const lift = 'transition-[transform,box-shadow,border-color] duration-200 ease-out motion-safe:hover:-translate-y-0.5 hover:shadow-[0_14px_32px_-18px_var(--shadow-tint-strong)]'

function CardView({ card: c, tone, posts, screen, dense, shownCount }: { card: Extract<Card, { kind: 'news' | 'post' }>; tone: Tone; posts: Record<string, MeetPost>; screen: boolean; dense: boolean; shownCount: number }) {
  const t = TONES[tone]
  const shell = cn('flex w-full min-w-0 flex-col rounded-(--radius-card) border', t.card, lift, screen ? (dense ? 'px-5 pb-5 pt-4' : 'px-6 pb-6 pt-5') : 'px-4 pb-4 pt-3.5')
  const eyebrow = cn('font-mono uppercase tracking-[0.14em]', screen ? 'text-[13px]' : 'text-[11px]', t.ink)
  const title = cn('font-semibold tracking-[-0.018em] text-ink text-balance', screen ? (dense ? 'mt-2.5 text-[21px] leading-[1.25]' : 'mt-3 text-[clamp(21px,1.3vw,25px)] leading-[1.22]') : 'mt-1.5 text-[17px] leading-snug')
  const body = cn('text-ink-soft text-pretty', screen ? 'mt-2.5 text-[clamp(16px,0.95vw,18px)] leading-[1.5]' : 'mt-1.5 text-[14px] leading-relaxed')

  switch (c.kind) {
    case 'news': {
      const where = c.source || host(c.url)
      const inner = (
        <>
          <p className={cn(eyebrow, 'flex items-center gap-2')}>
            <Icon icon={Newspaper} size="sm" />
            <span className="min-w-0 truncate">{where || 'Radar'}</span>
            {c.from === 'member' && <span className={cn('ml-auto shrink-0 rounded-full px-2 py-0.5 font-sans text-[11px] normal-case tracking-normal', t.chip)}>A member’s pick</span>}
          </p>
          <p className={title}>{c.title}</p>
          {c.why && <p className={body}>{c.why}</p>}
          {c.url && (
            <p className={cn('mt-auto flex items-center gap-1.5 pt-4 text-ink-muted', screen ? 'text-[14px]' : 'text-[13px]')}>
              <span className="truncate">{host(c.url)}</span>
              <Icon icon={ArrowUpRight} size="sm" />
            </p>
          )}
        </>
      )
      return !screen && c.url ? (
        <a href={c.url} target="_blank" rel="noopener noreferrer" className={cn(shell, 'press')} aria-label={`${c.title}, ${where} (opens in a new tab)`}>
          {inner}
        </a>
      ) : (
        <article className={shell}>{inner}</article>
      )
    }
    case 'post': {
      const p = posts[c.postId]
      if (!p) return null
      const face = (
        <>
          <TopicCardHead topic={p} />
          <TopicCardCounts votes={p.vote_count} comments={p.comment_count} />
        </>
      )
      // The board's card as it is, a little larger on the shared screen.
      return screen ? (
        <article className={cn(TOPIC_CARD_CLASS, 'w-full', lift)} style={{ zoom: dense ? 1.15 : shownCount === 1 ? 1.45 : 1.25 }}>
          <p className="eyebrow mb-3">From the board</p>
          {face}
        </article>
      ) : (
        <a href={`/board/${p.id}`} target="_blank" rel="noopener noreferrer" className={cn(TOPIC_CARD_CLASS, 'press w-full')}>
          <p className="eyebrow mb-2.5">From the board</p>
          {face}
        </a>
      )
    }
  }
}

/**
 * A slide's summary as plain text, never cards: a debate's sides in two
 * columns (a label and its line), notes as a compact list ("Git history ·
 * a linked list"). On the shared screen big and quiet; on a phone small.
 */
export function SlideText({ cards, size, className }: { cards: Card[]; size: 'screen' | 'phone'; className?: string }) {
  const sides = cards.filter((c): c is Extract<Card, { kind: 'side' }> => c.kind === 'side')
  const notes = cards.filter((c): c is Extract<Card, { kind: 'note' }> => c.kind === 'note')
  if (!sides.length && !notes.length) return null
  const screen = size === 'screen'
  return (
    <div className={cn('space-y-6', className)}>
      {sides.length > 0 && (
        <dl className={cn('grid', screen ? 'gap-x-14 gap-y-4' : 'gap-x-4 gap-y-3')} style={{ gridTemplateColumns: `repeat(${Math.min(sides.length, 3)}, minmax(0, 1fr))` }}>
          {sides.map((c, i) => (
            <div key={i} className={cn('border-l-2', i % 2 ? 'border-matcha/60' : 'border-vermillion/60', screen ? 'pl-5' : 'pl-3')}>
              <dt className={cn('font-semibold tracking-[-0.015em] text-ink', screen ? 'text-[clamp(22px,1.4vw,27px)]' : 'text-[15px]')}>{c.label}</dt>
              <dd className={cn('text-ink-soft text-pretty', screen ? 'mt-1.5 text-[clamp(17px,1.05vw,20px)] leading-[1.45]' : 'mt-0.5 text-[13px] leading-snug')}>{c.text}</dd>
            </div>
          ))}
        </dl>
      )}
      {notes.length > 0 && (
        <ul className={cn(screen ? 'space-y-2.5' : 'space-y-1.5')}>
          {notes.map((c, i) => (
            <li key={i} className={cn('flex items-baseline gap-3 text-ink', screen ? 'text-[clamp(20px,1.3vw,25px)]' : 'text-[14px]')}>
              <span aria-hidden className={cn('shrink-0 translate-y-[-0.15em] rounded-full bg-ink-muted/60', screen ? 'size-2' : 'size-1.5')} />
              <span className="min-w-0">
                <span className="font-semibold tracking-[-0.015em]">{c.title}</span>
                {c.text && <span className="text-ink-soft"> · {c.text}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
