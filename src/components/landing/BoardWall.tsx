import { ArrowFatUp, Eyes, HandWaving, Question, Wrench } from '@phosphor-icons/react/dist/ssr'
import { CATEGORY_TONE } from '@/lib/constants'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils/cn'

/**
 * The hero's visual: a wall of posts, the way the board looks mid-month.
 * Content is the picture. It shows the range (problems next to takes next to
 * things people built) faster than any sentence about "discussion" can.
 *
 * Illustrative, and labelled so. Real posts never appear on this public page:
 * a title can name a client.
 */

type Tone = keyof typeof DISC

const DISC = {
  curious: { bg: 'bg-indigo-jp', Glyph: Eyes },
  would_attend: { bg: 'bg-matcha', Glyph: HandWaving },
  explain_more: { bg: 'bg-wisteria', Glyph: Question },
  done_this: { bg: 'bg-saffron', Glyph: Wrench },
}

const POSTS: {
  kind: string
  label: string
  title: string
  votes: number
  reactions: Tone[]
  comments: number
}[] = [
  { kind: 'problem', label: 'Problem', title: 'CI takes 25 minutes and nobody knows which step is slow', votes: 7, reactions: ['done_this', 'curious'], comments: 4 },
  { kind: 'learned', label: 'Learned', title: 'Postgres advisory locks replaced our Redis mutex', votes: 5, reactions: ['curious', 'would_attend'], comments: 2 },
  { kind: 'take', label: 'Take', title: 'Most of our microservices should have been a module', votes: 9, reactions: ['explain_more', 'would_attend', 'curious'], comments: 11 },
  { kind: 'new_tech', label: 'New tech', title: 'Ran Bun in production for a week', votes: 4, reactions: ['curious'], comments: 3 },
  { kind: 'show_tell', label: 'Show & tell', title: 'A CLI that writes our release notes from merged PRs', votes: 6, reactions: ['would_attend', 'done_this'], comments: 5 },
  { kind: 'problem', label: 'Problem', title: 'Flaky e2e test passes locally, fails one run in five on CI', votes: 5, reactions: ['done_this'], comments: 6 },
  { kind: 'learned', label: 'Learned', title: 'Our LLM summaries drift after prompt changes. Evals fixed it.', votes: 8, reactions: ['curious', 'explain_more'], comments: 7 },
  { kind: 'new_tech', label: 'New tech', title: 'Tried the new React compiler on the dashboard', votes: 3, reactions: ['curious'], comments: 1 },
  { kind: 'take', label: 'Take', title: 'Code review should happen before the code is written', votes: 6, reactions: ['explain_more', 'curious'], comments: 9 },
]

function WallCard({ post, className }: { post: (typeof POSTS)[number]; className?: string }) {
  return (
    <div className={cn('rounded-(--radius-card) border border-border bg-paper p-4', className)}>
      <Badge tone={CATEGORY_TONE[post.kind]} dot>{post.label}</Badge>
      <p className="mt-2.5 text-[14px] font-semibold leading-snug tracking-[-0.01em] text-ink">{post.title}</p>
      <div className="mt-3.5 flex items-center gap-2.5 text-[12px] text-cha">
        <span className="inline-flex items-center gap-1 h-6 px-2 rounded-full border border-border text-ink-soft">
          <ArrowFatUp className="w-3 h-3" />
          <span className="tabular-nums font-semibold">{post.votes}</span>
        </span>
        <span className="flex -space-x-1">
          {post.reactions.map(r => {
            const { bg, Glyph } = DISC[r]
            return (
              <span key={r} className={cn('inline-flex items-center justify-center w-4.5 h-4.5 rounded-full text-white ring-2 ring-paper', bg)}>
                <Glyph size={10} weight="fill" />
              </span>
            )
          })}
        </span>
        <span className="ml-auto tabular-nums">{post.comments} {post.comments === 1 ? 'reply' : 'replies'}</span>
      </div>
    </div>
  )
}

export function BoardWall() {
  // Three columns, each offset vertically, so it reads as a wall rather than
  // a table. The bottom fades into the page.
  const cols = [POSTS.slice(0, 3), POSTS.slice(3, 6), POSTS.slice(6, 9)]
  return (
    <figure className="relative" aria-label="Example posts on the board: problems, things people learned, new tech, takes and show and tell.">
      <div
        aria-hidden
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[420px] overflow-hidden [mask-image:linear-gradient(to_bottom,#000_55%,transparent)]"
      >
        {cols.map((col, i) => (
          <div key={i} className={cn('space-y-4', i === 1 && 'sm:pt-10', i === 2 && 'hidden lg:block lg:pt-4')}>
            {col.map(p => <WallCard key={p.title} post={p} />)}
          </div>
        ))}
      </div>
      <figcaption className="mt-2 text-center text-[12px] text-cha">Examples of what lands on the board</figcaption>
    </figure>
  )
}

/** A hand-drawn marker stroke under one word. The one sketchy thing on the page. */
export function Marker({ children }: { children: React.ReactNode }) {
  return (
    <span className="relative inline-block">
      <span className="relative z-10">{children}</span>
      <svg
        aria-hidden
        viewBox="0 0 120 12"
        preserveAspectRatio="none"
        className="absolute left-[-4%] bottom-[-0.02em] w-[108%] h-[0.32em] text-saffron/45"
      >
        <path d="M2 8.5 C 28 3, 58 10.5, 86 5.5 S 112 4, 118 6" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      </svg>
    </span>
  )
}
