'use client'

import { Kers } from '@/components/kers/Kers'
import { ActivityHero, ResultsHero } from '@/components/meet/ActivityPanel'
import { MemeSlide } from '@/components/meet/MemeSlide'
import { SegmentCards, SlideText } from '@/components/meet/SegmentCards'
import { SURVEY_PATH, TopicBody, topicPost } from '@/components/meet/TopicBody'
import { JoinQr } from '@/components/meet/JoinQr'
import { cn } from '@/lib/utils/cn'
import type { PublicActivity } from '@/lib/meet/activity'
import { isRealCard, segmentCards, type MeetPost, type Segment, type SlideKind } from '@/lib/meeting'

/** What the activity hero needs from the screen around it (PresenterView's handlers; the editor's no-ops). */
export type HeroControls = Omit<React.ComponentProps<typeof ActivityHero>, 'activity' | 'cue' | 'participants'>

/**
 * One slide's content on the shared screen, laid out by its kind: an
 * activity (ActivityHero), its results (ResultsHero), a meme, one big line,
 * a title, a board topic, or cards. The presenter screen draws it live; the
 * slide editor draws the same thing as its preview, so what's edited is what
 * the room sees.
 */
export function SlideBody({
  seg,
  kind,
  activity,
  posts,
  section,
  first,
  last,
  participants,
  joinPath,
  hero,
}: {
  seg: Segment
  kind: SlideKind
  activity: PublicActivity | null
  posts: Record<string, MeetPost>
  /** The section's title (the eyebrow). */
  section?: string
  first: boolean
  last: boolean
  participants: number
  /** The first title slide's QR to join (null: none). */
  joinPath: string | null
  hero: HeroControls
}) {
  const cue = seg.cue?.trim() || null
  const topic = kind === 'content' ? topicPost(segmentCards(seg), posts) : null
  if (kind === 'activity' && activity) {
    return <ActivityHero key={activity.id} activity={activity} cue={cue} participants={participants} {...hero} />
  }
  if (kind === 'results' && activity) {
    return <ResultsHero key={`${activity.id}:${activity.status}`} activity={activity} title={seg.title} cue={cue} participants={participants} moderation={hero.presenting ? hero.moderation : null} />
  }
  if (kind === 'meme' && seg.meme) return <MemeSlide key={seg.id} meme={seg.meme} size="screen" />
  if (kind === 'text') {
    const text = (
      <div key={seg.id} className="animate-fade-up my-auto w-full max-w-[62rem]">
        <p className="eyebrow">{section}</p>
        <h1 className="mt-5 text-[clamp(48px,3.8vw,76px)] font-semibold leading-[1.04] tracking-[-0.035em] text-ink text-balance">{seg.title}</h1>
        {cue && <p className="mt-7 max-w-[48rem] text-[clamp(21px,1.4vw,27px)] leading-[1.4] text-ink-soft text-pretty">{cue}</p>}
      </div>
    )
    // The last slide: the guild survey, to scan.
    if (!last) return text
    return (
      <div key={seg.id} className="my-auto flex w-full items-center gap-16">
        <div className="min-w-0 flex-1">{text}</div>
        <JoinQr path={SURVEY_PATH} size={260} caption="Fill the 2-minute survey" className="shrink-0" />
      </div>
    )
  }
  if (kind === 'title' || kind === 'activity' || kind === 'results' || kind === 'meme') {
    // An activity or results slide with no activity seeded: its title and cue, nothing to break.
    // The first slide: a QR to join, big (the rehearsal's own link in a live rehearsal).
    if (joinPath) {
      return (
        <div key={seg.id} className="my-auto flex w-full items-center gap-16">
          <TitleStage eyebrow="Welcome" title={seg.title} cue={cue} kers={false} section={section} />
          <JoinQr path={joinPath} size={280} caption="Scan to join" className="mr-6 shrink-0" />
        </div>
      )
    }
    return <TitleStage key={seg.id} eyebrow={kind !== 'title' ? section ?? '' : first ? 'Welcome' : 'Next up'} title={seg.title} cue={cue} kers={kind === 'title'} section={kind === 'title' ? section : undefined} />
  }
  if (topic) {
    // A discussion topic: the post's title and whole description, to talk over (TopicBody).
    const cards = segmentCards(seg)
    const extra = cards.some(c => c.kind === 'side' || c.kind === 'note')
    return (
      <div key={seg.id} className="animate-fade-up my-auto flex w-full gap-14 py-4">
        <TopicBody post={topic} eyebrow={section} size="screen" className="min-w-0 flex-1" />
        {extra && <SlideText cards={cards} size="screen" className="w-[min(30%,26rem)] shrink-0 self-center" />}
      </div>
    )
  }
  const cards = segmentCards(seg)
  const real = cards.filter(isRealCard)
  // An agenda written before cue and cards: its detail, as before.
  const fallback = !cue && !seg.cards?.length ? seg.detail : ''
  return (
    <div key={seg.id} className="my-auto flex w-full flex-col py-4">
      <div className="animate-fade-up shrink-0">
        <p className="eyebrow">{section}</p>
        <h1 className="mt-3 max-w-[36ch] text-[clamp(36px,2.5vw,48px)] font-semibold leading-[1.1] tracking-[-0.03em] text-ink text-balance">{seg.title}</h1>
        {cue ? (
          <p className="mt-4 flex max-w-[60rem] items-start gap-3.5 text-[clamp(20px,1.3vw,24px)] leading-[1.4] text-ink-soft text-pretty">
            <span aria-hidden className="mt-[0.55em] size-2.5 shrink-0 rounded-full bg-matcha shadow-[0_0_0_5px_color-mix(in_oklab,var(--color-matcha)_16%,transparent)]" />
            {cue}
          </p>
        ) : fallback ? (
          <p className="mt-6 max-w-[60ch] text-[clamp(18px,1.15vw,22px)] leading-relaxed text-ink-soft">{fallback}</p>
        ) : null}
      </div>
      {real.length > 0 ? (
        <div className={cn('mt-12 grid items-start gap-12', cards.length > real.length && real.length === 1 ? 'grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]' : 'grid-cols-1')}>
          <SegmentCards cards={real} posts={posts} size="screen" className={real.length === 1 && cards.length === 1 ? 'max-w-[62rem]' : ''} />
          <SlideText cards={cards} size="screen" className={real.length === 1 ? 'self-center' : ''} />
        </div>
      ) : (
        <SlideText cards={cards} size="screen" className="mt-12 max-w-[64rem]" />
      )}
    </div>
  )
}

/**
 * A section's intro (and the screen before the start): "Next up", the title
 * big, the one cue line, and Kers bouncing beside it, a game show's
 * get-ready beat without any countdown.
 */
export function TitleStage({ eyebrow, title, cue, kers, section, children }: { eyebrow: string; title: string; cue: string | null; kers: boolean; section?: string; children?: React.ReactNode }) {
  return (
    <div className="my-auto flex w-full items-center gap-16">
      <div className="animate-fade-up min-w-0 flex-1">
        <p className="eyebrow flex items-center gap-3">
          <span>{eyebrow}</span>
          {section && section !== title && (
            <>
              <span aria-hidden className="h-px w-6 bg-border-strong" />
              <span className="text-ink-muted">{section}</span>
            </>
          )}
        </p>
        <h1 className="mt-5 max-w-[22ch] text-[clamp(52px,4.2vw,84px)] font-semibold leading-[1.02] tracking-[-0.04em] text-ink text-balance">{title}</h1>
        {cue && <p className="mt-7 max-w-[46rem] text-[clamp(21px,1.4vw,27px)] leading-[1.4] text-ink-soft text-pretty">{cue}</p>}
        {children}
      </div>
      {kers && (
        <div aria-hidden className="gb-meme-in mr-10 shrink-0">
          <Kers size={220} expression="excited" colour="meeting" motion="hop" special="happy" />
        </div>
      )}
    </div>
  )
}

