'use client'

import { useEffect, useState } from 'react'
import { line } from '@guildboard/guildbot'
import { cn } from '@/lib/utils/cn'
import { GuildBuilding } from '@/components/hours/GuildBuilding'
import { SCENES, sceneAt, sceneBySlug, youtubeSearch } from '@/lib/hours/scenes'

const range = (from: number, to: number) => {
  const h = (n: number) => (n % 12 === 0 ? 12 : n % 12) + (n % 24 < 12 ? 'am' : 'pm')
  return `${h(from)} to ${h(to)}`
}

/**
 * The guild building, every hour of the day. Opens on the hour where you are
 * (or the one in the link), and the timeline lets you visit the others; the
 * address follows along so any hour can be shared. GuildBot narrates each
 * one, and each has a song (a link out, nothing plays here).
 */
export function HoursPage({ initialSlug }: { initialSlug: string | null }) {
  const [slug, setSlug] = useState<string>(initialSlug ?? 'golden-hour')
  const [now, setNow] = useState<string | null>(null)

  // Your hour, from your clock (after load, so the server never guesses it).
  useEffect(() => {
    const id = setTimeout(() => {
      const here = sceneAt(new Date().getHours()).slug
      setNow(here)
      if (!initialSlug) setSlug(here)
    }, 0)
    return () => clearTimeout(id)
  }, [initialSlug])

  const scene = sceneBySlug(slug) ?? SCENES[0]
  const index = SCENES.indexOf(scene)
  const go = (next: string) => {
    setSlug(next)
    const url = new URL(window.location.href)
    url.searchParams.set('h', next)
    window.history.replaceState(null, '', url)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea')) return
      if (e.key === 'ArrowRight') go(SCENES[(index + 1) % SCENES.length].slug)
      if (e.key === 'ArrowLeft') go(SCENES[(index - 1 + SCENES.length) % SCENES.length].slug)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const light = scene.tone === 'light'
  const narration = line(scene.line, scene.slug)

  return (
    <main
      className={cn('gb-hours min-h-dvh w-full overflow-x-hidden flex flex-col items-center px-5 pt-10 pb-8 transition-colors duration-700', light ? 'text-[#F3EEE6]' : 'text-[#1F1A14]')}
      style={{ background: `linear-gradient(to bottom, ${scene.sky[0]}, ${scene.sky[1]})` }}
    >
      <header className="w-full max-w-2xl text-center">
        <p className={cn('font-mono text-[11px] uppercase tracking-[0.3em]', light ? 'text-white/60' : 'text-black/50')}>
          ◈ the guild building
        </p>
        <h1 className="mt-2 font-serif text-[clamp(30px,6vw,46px)] leading-[1.05]">One building, every hour of the day.</h1>
      </header>

      {/* The timeline. */}
      <nav aria-label="Hours of the day" className="mt-7 w-full max-w-3xl">
        <div className={cn('overflow-hidden whitespace-nowrap font-mono text-[11px] tracking-wider select-none', light ? 'text-white/40' : 'text-black/35')} aria-hidden>
          {'='.repeat(160)}
        </div>
        <ol className="mt-2 flex gap-1 overflow-x-auto pb-1 [scrollbar-width:none]">
          {SCENES.map(s => {
            const on = s.slug === scene.slug
            return (
              <li key={s.slug} className="shrink-0">
                <button
                  type="button"
                  onClick={() => go(s.slug)}
                  aria-current={on ? 'true' : undefined}
                  className={cn(
                    'press flex flex-col items-start rounded-md px-2.5 py-1.5 font-mono text-[11px] leading-tight transition-colors',
                    on ? (light ? 'bg-white/15' : 'bg-black/10') : light ? 'hover:bg-white/8 opacity-70' : 'hover:bg-black/5 opacity-70',
                  )}
                >
                  <span className="tabular-nums">{s.clock}</span>
                  <span className="whitespace-nowrap">
                    {s.name}
                    {now === s.slug && <span className="ml-1 rounded-sm bg-[#E8913A] px-1 text-[9px] font-bold text-[#1F1A14]">now</span>}
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
        <div className={cn('mt-1 overflow-hidden whitespace-nowrap font-mono text-[11px] tracking-wider select-none', light ? 'text-white/40' : 'text-black/35')} aria-hidden>
          {'-'.repeat(160)}
        </div>
      </nav>

      {/* The building. */}
      <section aria-live="polite" className="mt-6 w-full max-w-xl">
        <GuildBuilding key={scene.slug} scene={scene} className="gb-building w-full h-auto rounded-2xl shadow-[0_30px_60px_-30px_rgba(0,0,0,0.6)]" />
      </section>

      {/* What GuildBot says, and the song. */}
      <section className="mt-7 w-full max-w-xl">
        <p className={cn('font-mono text-[11px] uppercase tracking-[0.25em]', light ? 'text-white/60' : 'text-black/50')}>
          {scene.name} · {range(scene.from, scene.to)}
        </p>
        <p className="mt-2 font-serif italic text-[clamp(19px,3.2vw,24px)] leading-snug">
          &ldquo;{narration}&rdquo;
        </p>
        <p className={cn('mt-1.5 text-[13px]', light ? 'text-white/60' : 'text-black/55')}>GuildBot, from the shop window downstairs</p>

        <div className={cn('mt-6 rounded-xl px-4 py-3 font-mono text-[12.5px] leading-relaxed border', light ? 'border-white/15 bg-white/5' : 'border-black/10 bg-white/35')}>
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span className={light ? 'text-white/55' : 'text-black/50'}>♫ playing</span>
            <span className="font-semibold">{scene.song.title}</span>
            <span className={light ? 'text-white/70' : 'text-black/60'}>· {scene.song.artist}</span>
          </p>
          <p className={cn('mt-0.5', light ? 'text-white/55' : 'text-black/50')}>{scene.song.why}</p>
          <a
            href={youtubeSearch(scene.song)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1.5 inline-block underline decoration-dotted underline-offset-4 hover:decoration-solid"
          >
            Listen on YouTube ↗
          </a>
        </div>
      </section>

      <footer className={cn('mt-auto pt-12 w-full max-w-xl text-center font-mono text-[11px] leading-relaxed', light ? 'text-white/50' : 'text-black/45')}>
        <p>
          Inspired by <a href="https://chaitapri.wtf" target="_blank" rel="noopener noreferrer" className="underline decoration-dotted underline-offset-2">chaitapri.wtf</a>
          {' '}and <a href="https://saloon.wtf" target="_blank" rel="noopener noreferrer" className="underline decoration-dotted underline-offset-2">saloon.wtf</a>.
        </p>
        <p className="mt-1">
          Made by the <a href="https://skillrev.in" target="_blank" rel="noopener noreferrer" className="underline decoration-dotted underline-offset-2">SkillRev</a> guild. ← → to change the hour.
        </p>
      </footer>
    </main>
  )
}
