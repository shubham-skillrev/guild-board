import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSystemUsername } from '@/lib/system/identity'
import type { ActivityLevel } from '@/lib/people'

/**
 * The public guild hall on the leaderboard: lit only by things everyone can
 * already see under a name. Sparks received, named topics (and how many were
 * picked), named comments, Show & Tell and Radar links. Never visits, never
 * anything anonymous, so the hall can't reveal who writes as a ghost.
 *
 * Quiet members are never named: their windows are sent without a username
 * at all, so not even the page source says who is dark. The viewer's own
 * window is the one exception, shown to them as "you".
 */

export interface PublicStats {
  sparks: number
  topics: number
  picked: number
  comments: number
  demos: number
  radar: number
  score: number
}

export interface PublicWindow {
  /** Stable key only; not a user id for unnamed windows. */
  key: string
  userId: string | null
  username: string | null
  level: ActivityLevel
  stats: PublicStats | null
  isYou: boolean
}

export const SCORE_WEIGHTS = { sparks: 3, picked: 2, topics: 1, comments: 1, demos: 5, radar: 1 } as const

function levelOf(score: number): ActivityLevel {
  if (score >= 15) return 'driving'
  if (score >= 5) return 'regular'
  if (score >= 1) return 'showing_up'
  return 'quiet'
}

export async function getPublicHall(viewerId: string | null): Promise<{ windows: PublicWindow[]; lit: PublicWindow[] }> {
  const admin = createAdminClient()
  const [{ data: users }, { data: topics }, { data: sparks }, { data: comments }, { data: demos }, { data: radar }] = await Promise.all([
    admin.from('users').select('id, username').eq('is_system', false),
    admin.from('topics').select('user_id, is_selected, is_anonymous').eq('is_deleted', false),
    admin.from('sparks').select('to_user_id'),
    admin.from('comments').select('user_id, is_anonymous').eq('is_deleted', false),
    admin.from('demos').select('user_id').in('status', ['confirmed', 'done']),
    admin.from('radar_links').select('user_id').eq('is_deleted', false),
  ])

  const tally = <T,>(rows: T[] | null | undefined, key: (r: T) => string | null | false) => {
    const m = new Map<string, number>()
    for (const r of rows ?? []) { const k = key(r); if (k) m.set(k, (m.get(k) ?? 0) + 1) }
    return m
  }
  const topicN = tally(topics, t => !t.is_anonymous && t.user_id)
  const pickedN = tally(topics, t => !t.is_anonymous && t.is_selected && t.user_id)
  const sparkN = tally(sparks, s => s.to_user_id)
  const commentN = tally(comments, c => !c.is_anonymous && c.user_id)
  const demoN = tally(demos, d => d.user_id)
  const radarN = tally(radar, r => r.user_id)

  const rows = (users ?? [])
    .filter(u => !isSystemUsername(u.username))
    .map(u => {
      const s = {
        sparks: sparkN.get(u.id) ?? 0,
        topics: topicN.get(u.id) ?? 0,
        picked: pickedN.get(u.id) ?? 0,
        comments: commentN.get(u.id) ?? 0,
        demos: demoN.get(u.id) ?? 0,
        radar: radarN.get(u.id) ?? 0,
      }
      const score = (Object.keys(SCORE_WEIGHTS) as (keyof typeof SCORE_WEIGHTS)[]).reduce((n, k) => n + s[k] * SCORE_WEIGHTS[k], 0)
      return { id: u.id, username: u.username as string, stats: { ...s, score } }
    })
    .sort((a, b) => b.stats.score - a.stats.score || a.username.localeCompare(b.username))

  let dark = 0
  const windows: PublicWindow[] = rows.map(r => {
    const level = levelOf(r.stats.score)
    const isYou = r.id === viewerId
    if (level === 'quiet' && !isYou) {
      dark += 1
      return { key: `dark-${dark}`, userId: null, username: null, level, stats: null, isYou: false }
    }
    return { key: r.id, userId: r.id, username: r.username, level, stats: r.stats, isYou }
  })
  return { windows, lit: windows.filter(w => w.level !== 'quiet') }
}
