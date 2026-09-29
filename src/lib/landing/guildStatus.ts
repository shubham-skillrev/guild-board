import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { mediumLabel } from '@/lib/bytes/labels'

/**
 * What the public landing page is allowed to know about the guild.
 *
 * Cycles are only readable by signed-in members under RLS, and the landing
 * page is mostly seen by people who are not signed in yet. So this reads with
 * the admin client and returns aggregates only: a date, a status and a count.
 * Never titles. The page is public, and a problem title can name a client.
 */
export interface GuildStatus {
  /** Lowercase month name, e.g. "october", for the "This month" section. */
  month: string | null
  /** Formatted for display, or null when there is no cycle at all. */
  nextSession: { date: string; time: string | null } | null
  /** The upcoming meeting as an ISO timestamp, for the live countdown. Null
      when there is no confirmed future meeting (a guessed date is not
      counted down to). */
  meetingAt: string | null
  isOpen: boolean
  problemCount: number
}

const EMPTY: GuildStatus = { month: null, nextSession: null, meetingAt: null, isOpen: false, problemCount: 0 }

// The guild meets in India. Server time is UTC, so format explicitly rather
// than let the deployment region pick the day.
const TZ = 'Asia/Kolkata'

function secondFriday(year: number, month: number): Date {
  const first = new Date(Date.UTC(year, month - 1, 1))
  const offset = (5 - first.getUTCDay() + 7) % 7
  return new Date(Date.UTC(year, month - 1, 1 + offset + 7))
}

/** "Fri 9 Oct". */
function formatDate(d: Date): string {
  return d
    .toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: TZ })
    .replace(',', '')
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: TZ })
}

export async function getGuildStatus(): Promise<GuildStatus> {
  try {
    const admin = createAdminClient()
    const columns = 'id, month, year, status, meeting_at'

    // Same priority as /api/cycles: the open cycle, else the next upcoming one.
    const { data: open } = await admin
      .from('cycles')
      .select(columns)
      .eq('status', 'open')
      .order('year', { ascending: false })
      .order('month', { ascending: false })
      .limit(1)
      .maybeSingle()

    const cycle =
      open ??
      (
        await admin
          .from('cycles')
          .select(columns)
          .eq('status', 'upcoming')
          .order('year', { ascending: true })
          .order('month', { ascending: true })
          .limit(1)
          .maybeSingle()
      ).data

    if (!cycle) return EMPTY

    const meeting = cycle.meeting_at ? new Date(cycle.meeting_at) : null
    const hasMeeting = !!meeting && !Number.isNaN(meeting.getTime())
    // A past meeting on a still-open cycle is not a "next" session.
    const upcoming = hasMeeting && meeting.getTime() > Date.now()
    const isOpen = cycle.status === 'open' && (!hasMeeting || upcoming)

    let nextSession: GuildStatus['nextSession'] = null
    if (upcoming) {
      nextSession = { date: formatDate(meeting), time: formatTime(meeting) }
    } else if (!hasMeeting) {
      // No date set yet: the guild's default is the second Friday. Show the
      // day only, since the time is a guess.
      nextSession = { date: formatDate(secondFriday(cycle.year, cycle.month)), time: null }
    }

    let problemCount = 0
    if (cycle.status === 'open') {
      const { count } = await admin
        .from('topics')
        .select('id', { count: 'exact', head: true })
        .eq('cycle_id', cycle.id)
        .eq('is_deleted', false)
      problemCount = count ?? 0
    }

    const month = new Date(Date.UTC(cycle.year, cycle.month - 1, 1))
      .toLocaleDateString('en-GB', { month: 'long', timeZone: 'UTC' })
      .toLowerCase()

    return { month, nextSession, meetingAt: upcoming ? meeting.toISOString() : null, isOpen, problemCount }
  } catch {
    // The landing page must render even if the database is unreachable.
    return EMPTY
  }
}

export interface LandingByte {
  id: string
  title: string
  url: string
  source: string
}

/**
 * The latest digest's first three articles, for the "between sessions"
 * section. Public pieces from public feeds, so unlike post titles they are
 * safe on a public page. Videos are left out: their titles are written for
 * clicks ("X has gone completely off the rails"), which is not a line to put
 * next to the SkillRev name. Empty when nothing is published, and the section
 * hides itself.
 */
export async function getLatestBytes(): Promise<LandingByte[]> {
  try {
    const admin = createAdminClient()
    const { data: digest } = await admin
      .from('byte_digests')
      .select('id')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!digest) return []

    const { data } = await admin
      .from('bytes')
      .select('id, source, source_name, source_title, url')
      .eq('digest_id', digest.id)
      .neq('source', 'video')
      .order('position', { ascending: true })
      .limit(3)

    return (data ?? []).map(b => ({
      id: b.id,
      title: b.source_title,
      url: b.url,
      source: b.source_name ?? mediumLabel(b.source),
    }))
  } catch {
    return []
  }
}
