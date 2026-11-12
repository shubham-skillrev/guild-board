'use client'

import { ArrowUpRight, CheckCircle, Circle, EnvelopeSimple, Newspaper, Sparkle } from '@phosphor-icons/react/dist/ssr'
import type { Icon as PhosphorIcon } from '@phosphor-icons/react'
import { Icon } from '@/components/ui/Icon'
import { TOPIC_CARD_CLASS, TopicCardCounts, TopicCardHead } from '@/components/topics/TopicCard'
import { cn } from '@/lib/utils/cn'
import type { Card, MeetPost, SlotStatus } from '@/lib/meeting'

/**
 * A segment's cards (lib/meeting.ts Card): on the shared screen under the
 * cue, and on every phone between activities. Each kind has its own soft
 * tint, so a screen of three news items and a debate's two sides reads at a
 * glance; the one saffron accent stays the presenter's button. A post is the
 * board's own card (TopicCardHead), not a lookalike.
 *
 *   screen   a grid, 1-4 across, big type for a shared screen
 *   strip    one compact row (an activity is open and the cards step back)
 *   phone    one column; news opens its source, a post its board page,
 *            both in a new tab so the room stays open
 */

export type CardsSize = 'screen' | 'strip' | 'phone'

type Tone = 'indigo' | 'wisteria' | 'matcha' | 'vermillion' | 'neutral'

/** Tint, edge and ink per tone: pastel on paper, the token's own hue for the eyebrow. */
const TONES: Record<Tone, { card: string; ink: string; chip: string }> = {
  indigo: { card: 'bg-indigo-jp/[0.07] border-indigo-jp/20 dark:bg-indigo-jp/[0.1]', ink: 'text-indigo-jp', chip: 'bg-indigo-jp/12 text-indigo-jp' },
  wisteria: { card: 'bg-wisteria/[0.08] border-wisteria/20 dark:bg-wisteria/[0.11]', ink: 'text-wisteria', chip: 'bg-wisteria/14 text-wisteria' },
  matcha: { card: 'bg-matcha/[0.07] border-matcha/20 dark:bg-matcha/[0.1]', ink: 'text-matcha', chip: 'bg-matcha/12 text-matcha' },
  vermillion: { card: 'bg-vermillion/[0.06] border-vermillion/20 dark:bg-vermillion/[0.1]', ink: 'text-vermillion', chip: 'bg-vermillion/12 text-vermillion' },
  neutral: { card: 'bg-paper border-border', ink: 'text-ink-muted', chip: 'bg-fill text-ink-muted' },
}

const NOTE_TONES: Tone[] = ['matcha', 'wisteria', 'indigo']
const SIDE_TONES: Tone[] = ['vermillion', 'matcha', 'indigo']

/** Each card's tone, from its kind and its place among cards of that kind. */
function tones(cards: Card[]): Tone[] {
  const seen: Record<string, number> = {}
  return cards.map(c => {
    const i = (seen[c.kind] = (seen[c.kind] ?? -1) + 1)
    switch (c.kind) {
      case 'news':
        return 'indigo'
      case 'slot':
        return 'wisteria'
      case 'side':
        return SIDE_TONES[i % SIDE_TONES.length]
      case 'note':
        return NOTE_TONES[i % NOTE_TONES.length]
      default:
        return 'neutral'
    }
  })
}

const SLOT: Record<SlotStatus, { label: string; icon: PhosphorIcon }> = {
  confirmed: { label: 'Confirmed', icon: CheckCircle },
  invited: { label: 'Invited', icon: EnvelopeSimple },
  open: { label: 'Open', icon: Circle },
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
  // A post card whose post is gone (deleted, another month) just isn't shown.
  const shown = cards.filter(c => c.kind !== 'post' || posts[c.postId])
  if (!shown.length) return null
  const tone = tones(shown)

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
      className={cn('stagger-children grid', screen ? 'gap-5' : 'gap-3', className)}
      style={screen ? { gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` } : undefined}
    >
      {shown.map((c, i) => (
        <li key={`${c.kind}-${i}`} className="flex min-w-0">
          <CardView card={c} tone={tone[i]} nth={shown.slice(0, i).filter(x => x.kind === c.kind).length} posts={posts} screen={screen} dense={screen && cols >= 4} />
        </li>
      ))}
    </ul>
  )
}

function stripLabel(c: Card, posts: Record<string, MeetPost>): string {
  switch (c.kind) {
    case 'news':
      return c.title
    case 'post':
      return posts[c.postId]?.title ?? ''
    case 'slot':
      return `${c.label} · ${SLOT[c.status].label}`
    case 'side':
      return `${c.label}: ${c.text}`
    case 'note':
      return c.title
  }
}

const lift = 'transition-[transform,box-shadow,border-color] duration-200 ease-out motion-safe:hover:-translate-y-0.5 hover:shadow-[0_14px_32px_-18px_var(--shadow-tint-strong)]'

function CardView({ card: c, tone, nth, posts, screen, dense }: { card: Card; tone: Tone; nth: number; posts: Record<string, MeetPost>; screen: boolean; dense: boolean }) {
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
        <article className={cn(TOPIC_CARD_CLASS, 'w-full', lift)} style={{ zoom: dense ? 1.15 : 1.25 }}>
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
    case 'slot': {
      const s = SLOT[c.status]
      return (
        <article className={shell}>
          <p className={eyebrow}>Show &amp; Tell</p>
          <p className={title}>{c.label}</p>
          {c.text && <p className={body}>{c.text}</p>}
          <p className={cn('mt-auto pt-4')}>
            <span className={cn('inline-flex items-center gap-1.5 rounded-full px-3 font-medium', screen ? 'h-9 text-[15px]' : 'h-7 text-[13px]', t.chip)}>
              <Icon icon={s.icon} size={screen ? 'md' : 'sm'} weight={c.status === 'confirmed' ? 'fill' : 'regular'} />
              {s.label}
            </span>
          </p>
        </article>
      )
    }
    case 'side':
      return (
        <article className={shell}>
          <p className={eyebrow}>Side {String.fromCharCode(65 + (nth % 26))}</p>
          <p className={cn(title, screen && !dense && 'text-[clamp(24px,1.5vw,30px)]')}>{c.label}</p>
          <p className={body}>{c.text}</p>
        </article>
      )
    case 'note':
      return (
        <article className={shell}>
          <Icon icon={Sparkle} size="sm" weight="fill" className={cn(t.ink, 'opacity-80')} />
          <p className={cn(title, screen ? 'mt-2.5' : 'mt-1')}>{c.title}</p>
          {c.text && <p className={body}>{c.text}</p>}
        </article>
      )
  }
}
