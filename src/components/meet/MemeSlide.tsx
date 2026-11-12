'use client'

import { Kers } from '@/components/kers/Kers'
import type { KersColour } from '@/components/kers/look'
import { cn } from '@/lib/utils/cn'
import type { Meme, MemeFace } from '@/lib/meeting'

/** A face's blush: only the strong moods. */
const COLOUR: Partial<Record<MemeFace, KersColour>> = { proud: 'proud', dramatic: 'dramatic', excited: 'proud', grumpy: 'dramatic', bored: 'bored' }
/** Each panel gets its own soft tint, like the poll tiles: two panels never match. */
const PANEL = ['bg-indigo-jp/[0.06] border-indigo-jp/20 dark:bg-indigo-jp/[0.1]', 'bg-vermillion/[0.06] border-vermillion/20 dark:bg-vermillion/[0.1]'] as const

/**
 * A meme slide (lib/meeting.ts Meme): a joke between sections, on the shared
 * screen and every phone. A Kers meme is drawn here from text: one or two
 * panels, each Kers with a face, a small label and a line, then an optional
 * punchline. An image meme is a file under public/meet/memes/ with its alt
 * text. Each panel lands in turn (none under reduced motion).
 */
export function MemeSlide({ meme, size }: { meme: Meme; size: 'screen' | 'phone' }) {
  const screen = size === 'screen'
  if (meme.src) {
    return (
      <figure className="gb-meme-in flex min-h-0 flex-1 flex-col items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- a local file the organiser dropped in; any size */}
        <img src={meme.src} alt={meme.alt ?? ''} className={cn('min-h-0 rounded-(--radius-card) border border-border object-contain', screen ? 'max-h-[64vh] max-w-full' : 'max-h-[60vh] w-full')} />
        {meme.caption && <figcaption className={cn('mt-6 text-center font-semibold tracking-[-0.02em] text-ink text-balance', screen ? 'text-[clamp(26px,1.9vw,36px)]' : 'text-[20px]')}>{meme.caption}</figcaption>}
      </figure>
    )
  }
  const panels = meme.panels ?? []
  return (
    <figure className={cn('flex flex-col items-center justify-center', screen && 'min-h-0 flex-1')}>
      {panels.length > 0 && (
        <div className={cn('grid w-full', screen ? 'max-w-[78rem] gap-6' : 'gap-3', panels.length === 2 ? 'grid-cols-2' : 'max-w-[40rem] grid-cols-1')}>
          {panels.map((p, i) => (
            <div
              key={i}
              className={cn('gb-meme-in flex flex-col items-center rounded-(--radius-card) border text-center', PANEL[i % 2], screen ? 'px-10 pb-10 pt-8' : 'px-3 pb-4 pt-3')}
              style={{ animationDelay: `${i * 450}ms` }}
            >
              {p.label && <p className={cn('font-mono uppercase tracking-[0.16em] text-ink-muted', screen ? 'text-[15px]' : 'text-[10px]')}>{p.label}</p>}
              <Kers size={screen ? 190 : 72} expression={p.face} colour={COLOUR[p.face] ?? 'smug'} motion={i === panels.length - 1 ? 'hop' : 'idle'} className={screen ? 'mt-6' : 'mt-2'} />
              <p className={cn('font-semibold tracking-[-0.025em] text-ink text-balance', screen ? 'mt-7 text-[clamp(28px,2.1vw,40px)] leading-[1.15]' : 'mt-2.5 text-[15px] leading-snug')}>{p.text}</p>
            </div>
          ))}
        </div>
      )}
      {meme.caption && (
        <figcaption
          className={cn('gb-meme-in text-center text-ink-soft text-balance', screen ? 'mt-10 text-[clamp(22px,1.5vw,28px)]' : 'mt-4 text-[15px]')}
          style={{ animationDelay: `${panels.length * 450}ms` }}
        >
          {meme.caption}
        </figcaption>
      )}
    </figure>
  )
}
