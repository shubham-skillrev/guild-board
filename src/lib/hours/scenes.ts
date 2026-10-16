import type { Activity, LineKey } from '@guildboard/guildbot'

/**
 * The guild building, every hour of the day: eight scenes for /hours (public)
 * and, later, the focus room. SkillRev's entry in the ".wtf" trend
 * (chaitapri.wtf, saloon.wtf): one place, told hour by hour.
 *
 * Each scene has a sky, how many of the building's sixteen windows are lit
 * (a story, never real people: /hours shows no live data), what GuildBot is
 * up to in his ground-floor window, his line (lines.ts, `hours.*`), and a song.
 *
 * Songs are drafts for sign-off and link to a YouTube search, never a guessed
 * video id; swap in exact links once approved.
 */
export interface HourScene {
  slug: string
  name: string
  /** Hours (0 to 23, local) this scene covers: from <= h < to. */
  from: number
  to: number
  /** The label on the timeline. */
  clock: string
  /** Sky, top to bottom. */
  sky: [string, string]
  /** Light text on a dark sky, dark text on a light one. */
  tone: 'light' | 'dark'
  celestial: { kind: 'moon' | 'sun'; x: number; y: number } | null
  stars: boolean
  /** Sixteen windows, top floor first, left to right: 1 lit, 0 dark. */
  windows: string
  /** Street lamps and the cart's bulb. */
  lampsOn: boolean
  activity: Activity
  line: LineKey
  song: { title: string; artist: string; why: string }
}

export const SCENES: HourScene[] = [
  {
    slug: 'late-night', name: 'Late night', from: 0, to: 5, clock: '12am',
    sky: ['#070B1A', '#1B2240'], tone: 'light', celestial: { kind: 'moon', x: 322, y: 52 }, stars: true,
    windows: '0000' + '0100' + '0000' + '0001', lampsOn: true,
    activity: 'sleeping', line: 'hours.late_night',
    song: { title: 'Midnight City', artist: 'M83', why: 'the 2am deploy anthem' },
  },
  {
    slug: 'dawn', name: 'Dawn', from: 5, to: 7, clock: '5am',
    sky: ['#2B2F5C', '#E9A47A'], tone: 'light', celestial: { kind: 'sun', x: 78, y: 210 }, stars: false,
    windows: '0000' + '0000' + '0010' + '0000', lampsOn: true,
    activity: 'waking', line: 'hours.dawn',
    song: { title: 'Here Comes the Sun', artist: 'The Beatles', why: 'it does, eventually' },
  },
  {
    slug: 'morning', name: 'Morning', from: 7, to: 10, clock: '7am',
    sky: ['#8EC5F2', '#F6E6C8'], tone: 'dark', celestial: { kind: 'sun', x: 96, y: 92 }, stars: false,
    windows: '0010' + '0110' + '1011' + '1101', lampsOn: false,
    activity: 'coffee', line: 'hours.morning',
    song: { title: 'Ilahi', artist: 'Arijit Singh', why: 'commute-with-the-window-down energy' },
  },
  {
    slug: 'standup', name: 'Standup', from: 10, to: 13, clock: '10am',
    sky: ['#6FB2EE', '#D8ECFA'], tone: 'dark', celestial: { kind: 'sun', x: 200, y: 44 }, stars: false,
    windows: '1111' + '1011' + '1111' + '1110', lampsOn: false,
    activity: 'coding', line: 'hours.standup',
    song: { title: 'Harder, Better, Faster, Stronger', artist: 'Daft Punk', why: 'a sprint, set to music' },
  },
  {
    slug: 'afternoon', name: 'Afternoon', from: 13, to: 16, clock: '1pm',
    sky: ['#7DB6E6', '#E8EEF2'], tone: 'dark', celestial: { kind: 'sun', x: 290, y: 58 }, stars: false,
    windows: '1101' + '1111' + '0111' + '1011', lampsOn: false,
    activity: 'lunch', line: 'hours.afternoon',
    song: { title: 'The Lazy Song', artist: 'Bruno Mars', why: 'the post-lunch slump, honestly' },
  },
  {
    slug: 'golden-hour', name: 'Golden hour', from: 16, to: 19, clock: '4pm',
    sky: ['#E59A5B', '#F7D79A'], tone: 'dark', celestial: { kind: 'sun', x: 330, y: 150 }, stars: false,
    windows: '1010' + '0110' + '1001' + '0100', lampsOn: false,
    activity: 'walking', line: 'hours.golden',
    song: { title: 'Golden Hour', artist: 'JVKE', why: 'it was right there' },
  },
  {
    slug: 'dusk', name: 'Dusk', from: 19, to: 21, clock: '7pm',
    sky: ['#2A2A55', '#C8707A'], tone: 'light', celestial: { kind: 'moon', x: 70, y: 70 }, stars: false,
    windows: '0100' + '1001' + '0010' + '0110', lampsOn: true,
    activity: 'music', line: 'hours.dusk',
    song: { title: 'Phir Se Ud Chala', artist: 'A.R. Rahman, Mohit Chauhan', why: 'the ride home' },
  },
  {
    slug: 'night', name: 'Night', from: 21, to: 24, clock: '9pm',
    sky: ['#0B1026', '#272E52'], tone: 'light', celestial: { kind: 'moon', x: 300, y: 64 }, stars: true,
    windows: '0010' + '0000' + '1000' + '0100', lampsOn: true,
    activity: 'meditating', line: 'hours.night',
    song: { title: 'Clocks', artist: 'Coldplay', why: 'one more build before bed' },
  },
]

export function sceneAt(hour: number): HourScene {
  return SCENES.find(s => hour >= s.from && hour < s.to) ?? SCENES[0]
}

export function sceneBySlug(slug: string | null | undefined): HourScene | null {
  return SCENES.find(s => s.slug === slug) ?? null
}

/** The hour in India, where SkillRev is: for the share card, which has no viewer clock. */
export function indiaHour(now = new Date()): number {
  return Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Kolkata' }).format(now))
}

export function youtubeSearch(song: HourScene['song']): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${song.title} ${song.artist}`)}`
}
