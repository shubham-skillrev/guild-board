/**
 * GuildBot's day. He lives on GuildBoard and keeps a routine, by the
 * viewer's own clock, so the corner of the screen is a little different
 * every time you look: asleep in his house at night, brushing his teeth in
 * the morning, coding through the working day, noodles at lunch, a walk,
 * a book, headphones, a bit of meditation before bed. Weekends start late
 * and have fewer laptops in them.
 *
 * A few states beat the routine (the host decides, see overrideFor):
 *   meeting  the guild meeting is on and nobody invited him: he sulks
 *   helping  you opened the chat: he gets up and comes over
 *   out      you've used this week's asks: he naps behind an OUT sign
 */
export type Activity =
  | 'sleeping'
  | 'waking'
  | 'brushing'
  | 'coffee'
  | 'coding'
  | 'lunch'
  | 'walking'
  | 'learning'
  | 'music'
  | 'meditating'

/** [start hour (may be fractional), activity], in order from midnight. */
type Day = [number, Activity][]

const WEEKDAY: Day = [
  [0, 'sleeping'],
  [7, 'waking'],
  [7.5, 'brushing'],
  [8, 'coffee'],
  [9, 'coding'],
  [13, 'lunch'],
  [14, 'coding'],
  [17.5, 'walking'],
  [18, 'learning'],
  [19.5, 'music'],
  [21, 'meditating'],
  [22, 'sleeping'],
]

const WEEKEND: Day = [
  [0, 'sleeping'],
  [9, 'waking'],
  [9.5, 'brushing'],
  [10, 'coffee'],
  [11, 'learning'],
  [13, 'lunch'],
  [14, 'music'],
  [16, 'walking'],
  [17, 'coding'],
  [19, 'meditating'],
  [21, 'music'],
  [22, 'sleeping'],
]

/** What he's up to at this moment of the viewer's day. */
export function activityAt(d: Date): Activity {
  const day = d.getDay() === 0 || d.getDay() === 6 ? WEEKEND : WEEKDAY
  const h = d.getHours() + d.getMinutes() / 60
  let current: Activity = day[0][1]
  for (const [start, activity] of day) if (h >= start) current = activity
  return current
}

/** How long a guild meeting is taken to last, from its start time. */
export const MEETING_MINUTES = 60

/** True while the guild meeting is on: from its start, for MEETING_MINUTES. */
export function meetingOn(meetingAt: string | null | undefined, now: Date): boolean {
  if (!meetingAt) return false
  const start = new Date(meetingAt).getTime()
  const t = now.getTime()
  return t >= start && t < start + MEETING_MINUTES * 60_000
}

/** True in the day after a meeting ended: he'd like to hear about it, not that he cares. */
export function meetingJustEnded(meetingAt: string | null | undefined, now: Date): boolean {
  if (!meetingAt) return false
  const end = new Date(meetingAt).getTime() + MEETING_MINUTES * 60_000
  const t = now.getTime()
  return t >= end && t < end + 24 * 3_600_000
}

/* ── His day, as it actually goes ──────────────────────────────────────────
   The routine above is the plan. The weather and the day bend it: too hot
   for his walk and he sits in the garden instead; raining and he watches it
   from the window with chai; iced coffee on hot mornings; some days a tiffin
   box at lunch, or a guitar instead of headphones. Seeded by the date, so
   it's the same all day and different tomorrow. */

export type Variant =
  | 'garden'     // walk time, too hot: shade, grass, lemonade
  | 'rainwatch'  // walk time, raining: by the window with chai
  | 'iced'       // coffee, but iced (a hot morning)
  | 'tiffin'     // lunch from a stacked tiffin box
  | 'guitar'     // music, played rather than heard
  | null

export interface DayWeather { temperature: number; code: number }

const raining = (code: number) => (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95

/** A stable number from 0 to 99 for a day and a salt. */
export function daySeed(d: Date, salt: string): number {
  const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}:${salt}`
  let h = 2166136261
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619) }
  return Math.abs(h) % 100
}

/** How today's version of an activity goes. */
export function variantOf(activity: Activity, d: Date, weather?: DayWeather | null): Variant {
  switch (activity) {
    case 'walking':
      if (weather && raining(weather.code)) return 'rainwatch'
      if (weather && weather.temperature >= 32) return 'garden'
      return null
    case 'coffee':
      return weather && weather.temperature >= 30 ? 'iced' : null
    case 'lunch':
      return daySeed(d, 'lunch') < 40 ? 'tiffin' : null
    case 'music':
      return daySeed(d, 'music') < 35 ? 'guitar' : null
    default:
      return null
  }
}
