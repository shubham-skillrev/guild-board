import { Markdown } from '@/components/ui/Markdown'
import { cn } from '@/lib/utils/cn'
import type { MeetPost } from '@/lib/meeting'

/**
 * A discussion topic's slide: the post's title and its complete description,
 * rendered as markdown the way the board does (react-markdown, no raw HTML,
 * so nothing unsafe gets through). On the shared screen the type and the
 * columns scale with the length so a long post still fits 1920×1080.
 */
export function TopicBody({ post, eyebrow, size, className }: { post: MeetPost; eyebrow?: string | null; size: 'screen' | 'phone'; className?: string }) {
  const body = post.description.trim()
  const n = body.length
  if (size === 'phone') {
    return (
      <article className={cn('pt-5', className)}>
        {eyebrow && <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-muted">{eyebrow}</p>}
        <h1 className="mt-2 text-[24px] font-semibold leading-tight tracking-[-0.02em] text-ink text-balance @3xl:text-[34px]">{post.title}</h1>
        {body && <div className="prose-guild mt-4 text-[15px] leading-relaxed @3xl:text-[18px]"><Markdown>{body}</Markdown></div>}
      </article>
    )
  }
  // Longer posts: smaller type, then two or three columns.
  const text = n > 1800 ? 'text-[clamp(15px,0.95vw,18px)]' : n > 900 ? 'text-[clamp(17px,1.1vw,21px)]' : 'text-[clamp(20px,1.35vw,26px)]'
  const cols = n > 2600 ? 'columns-3' : n > 900 ? 'columns-2' : ''
  return (
    <article className={cn('flex min-h-0 w-full flex-col', className)}>
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h1 className="mt-3 max-w-[40ch] text-[clamp(36px,2.6vw,52px)] font-semibold leading-[1.08] tracking-[-0.03em] text-ink text-balance">{post.title}</h1>
      {body && (
        <div className={cn('prose-guild mt-8 min-h-0 gap-14 leading-[1.5] text-ink-soft [&_*]:break-inside-avoid-column', text, cols, !cols && 'max-w-[62rem]')}>
          <Markdown>{body}</Markdown>
        </div>
      )}
    </article>
  )
}

/** The post a content slide is about, when the slide is a discussion topic: its only real card is one board post. */
export function topicPost(cards: { kind: string; postId?: string }[], posts: Record<string, MeetPost>): MeetPost | null {
  const real = cards.filter(c => c.kind === 'post' || c.kind === 'news')
  if (real.length !== 1 || real[0].kind !== 'post' || !real[0].postId) return null
  return posts[real[0].postId] ?? null
}

/** The guild survey (src/app/survey): shown on the agenda's last slide, a QR on the screen and a button on phones. */
export const SURVEY_PATH = '/survey'
