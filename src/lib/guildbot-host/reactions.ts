import 'server-only'
import { after } from 'next/server'
import { droughtTier, guard, line, writeComment, writeReply, type BoardStats, type TopicView } from '@guildboard/guildbot'
import { createAdminClient } from '@/lib/supabase/admin'
import { ensureSystemUser } from '@/lib/system/topics'
import { commentIsGhost, ghostHandle } from '@/lib/utils/anonymity'
import { publishBotTyping, publishTopicChange } from '@/lib/realtime/broadcast'
import { notifyOnComment, notifyGuildBotIntro } from '@/lib/push/notify'
import { postToSlack, escapeSlack, appLink } from '@/lib/slack/send'
import { llm } from './llm'
import { claim, countRecent, firedEver, firedInCycle, spokeOn, UNPROMPTED } from './events'
import { SASS, BOT_MARK, botSays } from './voice'

/**
 * When GuildBot speaks up on its own. Everything here runs after the
 * response, never throws, and stays quiet whenever in doubt.
 *
 * Caps (agreed in the plan): at most 2 unprompted comments a day across the
 * board, at most 1 per topic, at most 10 replies a day, and one reply per
 * thread. Problem posts get no pool jokes; a model comment there is held to
 * "supportive and practical" by the persona and the review.
 */

type Admin = ReturnType<typeof createAdminClient>

const UNPROMPTED_PER_DAY = 2
const REPLIES_PER_DAY = 10
const COMMENT_CHANCE = 0.25
const DAY = 86_400_000

/** Run a reaction after the response; log and swallow any failure. */
export function guildbotAfter(task: () => Promise<unknown>, label: string): void {
  if (!SASS) return
  after(async () => {
    try {
      await task()
    } catch (err) {
      console.warn(`guildbot ${label} failed`, err)
    }
  })
}

interface TopicRow {
  id: string
  cycle_id: string
  user_id: string
  title: string
  description: string
  category: string
  is_anonymous: boolean
  is_system: boolean
  is_deleted: boolean
  vote_count: number
  comment_count: number
  users: { username: string; roast_me: boolean } | { username: string; roast_me: boolean }[] | null
}

async function loadTopic(admin: Admin, topicId: string): Promise<TopicRow | null> {
  const { data } = await admin
    .from('topics')
    .select('id, cycle_id, user_id, title, description, category, is_anonymous, is_system, is_deleted, vote_count, comment_count, users!topics_user_id_fkey(username, roast_me)')
    .eq('id', topicId)
    .maybeSingle()
  return data && !data.is_deleted ? (data as TopicRow) : null
}

const joined = (u: TopicRow['users']) => (Array.isArray(u) ? u[0] : u) ?? null

/**
 * The topic as the bot may see it. A ghost is its handle and is never
 * teasable; the author's id never leaves this function.
 */
function viewOf(t: TopicRow): TopicView {
  const author = joined(t.users)
  return {
    id: t.id,
    title: t.title,
    body: t.description,
    kind: t.category,
    author: t.is_anonymous ? ghostHandle(t.user_id, t.id) : author?.username ?? 'someone',
    authorIsGhost: t.is_anonymous,
    authorRoastMe: !t.is_anonymous && author?.roast_me === true,
    voteCount: t.vote_count,
    commentCount: t.comment_count,
  }
}

async function cycleIsOpen(admin: Admin, cycleId: string): Promise<boolean> {
  const { data } = await admin.from('cycles').select('status, meeting_at').eq('id', cycleId).maybeSingle()
  if (data?.status !== 'open') return false
  return !data.meeting_at || new Date(data.meeting_at).getTime() > Date.now()
}

async function underDailyCap(admin: Admin): Promise<boolean> {
  return (await countRecent(admin, UNPROMPTED)) < UNPROMPTED_PER_DAY
}

/** Post as GuildBot, then tell the room and the topic's author. */
async function postAsBot(admin: Admin, topic: TopicRow, body: string, parentId: string | null): Promise<void> {
  const botId = await ensureSystemUser(admin)
  const { error } = await admin
    .from('comments')
    .insert({ topic_id: topic.id, user_id: botId, parent_id: parentId, body })
  if (error) {
    console.warn('guildbot comment insert failed', error.message)
    return
  }
  await Promise.all([
    publishTopicChange(topic.id, ['counts', 'comments']),
    notifyOnComment({ topicId: topic.id, parentCommentId: parentId, actorId: botId, actorLabel: 'GuildBot', body }),
  ])
}

/**
 * A new human topic. The month's first one gets a line from the pool (a
 * drought-breaker line if the bot had already complained); after that, a
 * one-in-four chance of a model-written comment.
 */
export async function onTopicPosted(topicId: string): Promise<void> {
  const admin = createAdminClient()
  const topic = await loadTopic(admin, topicId)
  if (!topic || topic.is_system || !(await cycleIsOpen(admin, topic.cycle_id))) return

  const { count: humanPosts } = await admin
    .from('topics')
    .select('id', { count: 'exact', head: true })
    .eq('cycle_id', topic.cycle_id)
    .eq('is_deleted', false)
    .eq('is_system', false)

  if (humanPosts === 1) {
    if (topic.category === 'problem' || !(await underDailyCap(admin))) return
    const key = (await firedInCycle(admin, topic.cycle_id, 'drought')) ? 'drought.broken' : 'cycle.first_post'
    const text = botSays(key, topic.cycle_id, 'comment')
    if (!text) return
    if (!(await claim(admin, { cycleId: topic.cycle_id, kind: 'first_post', key: 'first_post', topicId }))) return
    await postAsBot(admin, topic, text, null)
    return
  }

  if (Math.random() >= COMMENT_CHANCE) return
  if (!(await underDailyCap(admin)) || (await spokeOn(admin, topicId))) return
  if (!(await claim(admin, { cycleId: topic.cycle_id, kind: 'comment', key: `comment:${topicId}`, topicId }))) return

  await publishBotTyping(topicId)
  const text = await writeComment(llm, viewOf(topic))
  if (text) await postAsBot(admin, topic, text, null)
  else await publishTopicChange(topicId, ['comments']) // clears "typing" for anyone watching
}

/** A vote landed. Five and ten votes are worth a line, once per topic. */
export async function onVoteAdded(topicId: string): Promise<void> {
  const admin = createAdminClient()
  const topic = await loadTopic(admin, topicId)
  if (!topic || topic.is_system || topic.category === 'problem') return
  const milestone = topic.vote_count === 5 ? 5 : topic.vote_count === 10 ? 10 : null
  if (!milestone || !(await cycleIsOpen(admin, topic.cycle_id))) return
  if (!(await underDailyCap(admin)) || (await spokeOn(admin, topicId))) return

  const text = botSays(milestone === 5 ? 'votes.5' : 'votes.10', topicId, 'comment')
  if (!text) return
  if (!(await claim(admin, { cycleId: topic.cycle_id, kind: 'milestone', key: `milestone:${topicId}:${milestone}`, topicId }))) return
  await postAsBot(admin, topic, text, null)
}

/**
 * Someone replied to GuildBot. It answers once per thread (the thread being
 * the top-level comment it hangs off), then leaves the humans to it.
 */
export async function onCommentPosted(commentId: string): Promise<void> {
  const admin = createAdminClient()
  const { data: comment } = await admin
    .from('comments')
    .select('id, topic_id, parent_id, user_id, body, is_anonymous')
    .eq('id', commentId)
    .maybeSingle()
  if (!comment?.parent_id) return

  const botId = await ensureSystemUser(admin)
  if (comment.user_id === botId) return
  const { data: parent } = await admin.from('comments').select('id, user_id, body').eq('id', comment.parent_id).maybeSingle()
  if (!parent || parent.user_id !== botId) return

  const topic = await loadTopic(admin, comment.topic_id)
  if (!topic || !(await cycleIsOpen(admin, topic.cycle_id))) return
  if ((await countRecent(admin, ['reply'])) >= REPLIES_PER_DAY) return

  // Walk up to the top-level comment: one reply per thread, however deep.
  let rootId = parent.id as string
  for (let i = 0; i < 5; i++) {
    const { data: up } = await admin.from('comments').select('id, parent_id').eq('id', rootId).maybeSingle()
    if (!up?.parent_id) break
    rootId = up.parent_id
  }
  if (!(await claim(admin, { cycleId: topic.cycle_id, kind: 'reply', key: `reply:${rootId}`, topicId: topic.id }))) return

  // Name the replier the way the thread shows them: a ghost handle, or their
  // public username, teasable only if they opted in.
  const ghost = commentIsGhost(comment, { id: topic.id, user_id: topic.user_id, is_anonymous: topic.is_anonymous })
  let replier = ghostHandle(comment.user_id, topic.id)
  let replierRoastMe = false
  if (!ghost) {
    const { data: u } = await admin.from('users').select('username, roast_me').eq('id', comment.user_id).maybeSingle()
    replier = u?.username ?? 'someone'
    replierRoastMe = u?.roast_me === true
  }

  await publishBotTyping(topic.id)
  const text = await writeReply(llm, { topic: viewOf(topic), botSaid: parent.body, theySaid: comment.body, replier, replierRoastMe })
  if (text) await postAsBot(admin, topic, text, comment.id)
  else await publishTopicChange(topic.id, ['comments'])
}

/**
 * The daily check, run by the GuildBot cron: a drought message when nobody
 * has posted, and one wounded line if its own topics have no votes three
 * days before the meeting. Each fires at most once per cycle. `dry` reports
 * what would be sent without sending or recording it.
 */
export async function runDaily(
  cycle: { id: string; opens_at: string | null; created_at: string; meeting_at: string | null },
  { dry = false }: { dry?: boolean } = {},
): Promise<{ sent: string[] }> {
  const sent: string[] = []
  if (!SASS) return { sent }
  const admin = createAdminClient()
  const now = Date.now()

  const { data: topics } = await admin
    .from('topics')
    .select('is_system, vote_count')
    .eq('cycle_id', cycle.id)
    .eq('is_deleted', false)
  const botTopics = (topics ?? []).filter(t => t.is_system)
  const stats: BoardStats = {
    daysSinceOpen: Math.max(0, Math.floor((now - new Date(cycle.opens_at ?? cycle.created_at).getTime()) / DAY)),
    daysToMeeting: cycle.meeting_at ? Math.ceil((new Date(cycle.meeting_at).getTime() - now) / DAY) : null,
    humanPosts: (topics ?? []).length - botTopics.length,
    botPosts: botTopics.length,
  }
  if (stats.daysToMeeting !== null && stats.daysToMeeting <= 0) return { sent }

  const say = async (key: Parameters<typeof line>[0], kind: 'drought' | 'ignored', eventKey: string, vars: Record<string, string | number>) => {
    const text = line(key, cycle.id, vars)
    const checked = text ? guard(text, { surface: 'slack' }) : null
    if (!checked?.ok) return
    if (dry) { sent.push(checked.text); return }
    if (!(await claim(admin, { cycleId: cycle.id, kind, key: eventKey }))) return
    await postToSlack({ text: `${BOT_MARK} *GuildBot:* ${escapeSlack(checked.text)} ${appLink('/board?share=1', 'Share something')}` })
    sent.push(checked.text)
  }

  const tier = droughtTier(stats)
  if (tier) {
    await say(tier, 'drought', `drought:${tier}`, {
      days: stats.daysSinceOpen,
      bot_posts: stats.botPosts,
      ...(stats.daysToMeeting !== null ? { meeting_days: stats.daysToMeeting } : {}),
    })
  }

  const ignored = botTopics.length > 0 && botTopics.every(t => t.vote_count === 0)
  if (ignored && stats.daysToMeeting !== null && stats.daysToMeeting <= 3) {
    await say('bot.ignored', 'ignored', 'ignored', {})
  }

  return { sent }
}

/**
 * GuildBot says hello: once ever, the first time the daily cron runs on an
 * open cycle after launch, right after that month's suggested topics go up.
 * Recorded before sending, so a second run can never repeat it.
 */
export const INTRO_MAX = 800

export async function introduceOnce(
  cycle: { id: string; label: string },
  { dry = false }: { dry?: boolean } = {},
): Promise<{ sent: boolean; text?: string; reason?: string }> {
  if (!SASS) return { sent: false, reason: 'voice_off' }
  const admin = createAdminClient()
  if (await firedEver(admin, 'intro')) return { sent: false, reason: 'already_introduced' }

  // Said once ever, so it gets more room than a routine Slack line.
  const slack = botSays('intro.slack', 'intro', 'slack', { month: cycle.label }, INTRO_MAX)
  const push = botSays('intro.push', 'intro', 'push')
  if (!slack || !push) return { sent: false, reason: 'no_line' }
  if (dry) return { sent: false, reason: 'dry_run', text: slack }

  if (!(await claim(admin, { cycleId: cycle.id, kind: 'intro', key: 'intro' }))) return { sent: false, reason: 'already_introduced' }
  await notifyGuildBotIntro({ slack, push })
  return { sent: true, text: slack }
}
