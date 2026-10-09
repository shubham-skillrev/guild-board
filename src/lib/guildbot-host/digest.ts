import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { ensureSystemUser } from '@/lib/system/topics'
import { postToSlack, escapeSlack, appLink } from '@/lib/slack/send'
import { claim } from './events'
import { BOT_MARK, SASS, botSays } from './voice'

/**
 * GuildBot's Friday report in Slack: what moved on the board this week.
 *
 * Runs from the 11:00 IST cron, Fridays only (IST). Skipped in meeting week,
 * when the reminder already covers the board, and on a week where nothing
 * happened, which the drought messages handle instead. Once per Friday.
 *
 * Titles only, never authors. Poll questions and vote totals, never which
 * answer leads: results stay hidden until you vote, and Slack must not
 * undo that.
 */

const DAY = 86_400_000
const MEETING_WEEK_DAYS = 4

export interface DigestResult {
  sent: boolean
  reason?: string
  text?: string
}

/** Friday in India, whatever the server's timezone. */
function isFridayIST(now: Date): boolean {
  return new Intl.DateTimeFormat('en-GB', { weekday: 'long', timeZone: 'Asia/Kolkata' }).format(now) === 'Friday'
}

export async function weeklyDigest(
  cycle: { id: string; label: string; meeting_at: string | null },
  { now = new Date(), dry = false }: { now?: Date; dry?: boolean } = {},
): Promise<DigestResult> {
  if (!SASS) return { sent: false, reason: 'voice_off' }
  if (!isFridayIST(now)) return { sent: false, reason: 'not_friday' }
  if (cycle.meeting_at && Math.abs(new Date(cycle.meeting_at).getTime() - now.getTime()) < MEETING_WEEK_DAYS * DAY) {
    return { sent: false, reason: 'meeting_week' }
  }

  const admin = createAdminClient()
  const since = new Date(now.getTime() - 7 * DAY).toISOString()
  const botId = await ensureSystemUser(admin)

  const [{ data: topics }, { data: weekComments }, { data: polls }] = await Promise.all([
    admin
      .from('topics')
      .select('id, title, comment_count, is_system, created_at')
      .eq('cycle_id', cycle.id)
      .eq('is_deleted', false),
    admin
      .from('comments')
      .select('topic_id, user_id')
      .eq('is_deleted', false)
      .gte('created_at', since),
    admin
      .from('topic_polls')
      .select('question, total_votes, topic_id, topics!inner(cycle_id, is_deleted)')
      .eq('topics.cycle_id', cycle.id)
      .eq('topics.is_deleted', false)
      .order('total_votes', { ascending: false })
      .limit(1),
  ])

  const board = topics ?? []
  const onBoard = new Map(board.map(t => [t.id, t]))
  const posts = board.filter(t => !t.is_system && t.created_at >= since).length
  const humanComments = (weekComments ?? []).filter(c => c.user_id !== botId && onBoard.has(c.topic_id))
  if (posts === 0 && humanComments.length === 0) return { sent: false, reason: 'quiet_week' }

  const perTopic = new Map<string, number>()
  for (const c of humanComments) perTopic.set(c.topic_id, (perTopic.get(c.topic_id) ?? 0) + 1)
  const hottest = [...perTopic.entries()].sort((a, b) => b[1] - a[1])[0]
  const lonely = board.filter(t => t.comment_count === 0).slice(0, 3)
  const poll = (polls ?? [])[0]

  const day = now.toISOString().slice(0, 10)
  const opener = botSays('digest.weekly', `${cycle.id}:${day}`, 'slack', {
    posts,
    comments: humanComments.length,
    lonely: board.filter(t => t.comment_count === 0).length,
  })
  if (!opener) return { sent: false, reason: 'no_line' }

  const lines = [`*${BOT_MARK} GuildBot's Friday report · ${escapeSlack(cycle.label)}*`, escapeSlack(opener)]
  if (hottest) {
    const t = onBoard.get(hottest[0])!
    lines.push(`• Hottest thread: ${appLink(`/board/${t.id}`, truncate(t.title))} (${hottest[1]} new ${hottest[1] === 1 ? 'reply' : 'replies'})`)
  }
  if (lonely.length) {
    lines.push(`• Waiting for a first reply: ${lonely.map(t => appLink(`/board/${t.id}`, truncate(t.title, 50))).join(', ')}`)
  }
  if (poll && poll.total_votes > 0) {
    lines.push(`• Poll: ${appLink(`/board/${poll.topic_id}`, truncate(poll.question))} · ${poll.total_votes} ${poll.total_votes === 1 ? 'vote' : 'votes'}`)
  }
  lines.push(appLink('/board', 'Open the board'))
  const text = lines.join('\n')

  if (dry) return { sent: false, reason: 'dry_run', text }
  if (!(await claim(admin, { cycleId: cycle.id, kind: 'digest', key: `digest:${day}` }))) {
    return { sent: false, reason: 'already_sent' }
  }
  await postToSlack({ text })
  return { sent: true, text }
}

function truncate(s: string, n = 80): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s
}
