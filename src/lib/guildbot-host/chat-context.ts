import 'server-only'
import type { ChatByte, ChatContext, ChatTopic } from '@guildboard/guildbot'
import type { createAdminClient } from '@/lib/supabase/admin'
import { KINDS } from '@/lib/kinds'
import { TOKEN_LIMITS } from '@/lib/constants'
import { commentIsGhost, ghostHandle, joinedUsername } from '@/lib/utils/anonymity'
import { isSystemUsername } from '@/lib/system/identity'

/**
 * Everything GuildBot may know when answering one chat message, built with
 * the service role and stripped before it leaves this file.
 *
 * The identity firewall lives here. A topic's author becomes "@username",
 * a ghost handle, or "GuildBot", and nothing else: no user ids, no real names,
 * and never a hint that a ghost post is the asker's own. Votes and signals
 * are counts, never lists of people.
 */

type Admin = ReturnType<typeof createAdminClient>

export type ChatPage = { kind: 'board' } | { kind: 'topic'; topicId: string } | { kind: 'bytes'; byteId?: string }

const SNIPPET = 200
const MAX_TOPICS = 40

type TopicRow = {
  id: string
  user_id: string
  title: string
  description: string
  category: string
  vote_count: number
  comment_count: number
  is_anonymous: boolean
  is_system?: boolean
  users?: { username?: string } | { username?: string }[] | null
  cycles?: { label?: string } | { label?: string }[] | null
}

const TOPIC_COLUMNS =
  'id, user_id, title, description, category, vote_count, comment_count, is_anonymous, is_system, users!topics_user_id_fkey(username), cycles(label)'

function authorOf(t: TopicRow): string {
  const username = joinedUsername(t.users)
  if (!t.is_anonymous && (t.is_system || isSystemUsername(username))) return 'GuildBot'
  if (t.is_anonymous) return ghostHandle(t.user_id, t.id)
  return `@${username ?? 'someone'}`
}

function toChatTopic(t: TopicRow): ChatTopic {
  const month = Array.isArray(t.cycles) ? t.cycles[0]?.label : t.cycles?.label
  return {
    id: t.id,
    title: t.title,
    kind: t.category,
    author: authorOf(t),
    votes: t.vote_count,
    comments: t.comment_count,
    snippet: t.description.replace(/\s+/g, ' ').slice(0, SNIPPET),
    month: month ?? '',
  }
}

/** Search words from the message, safe to put in a PostgREST filter. */
function keywords(message: string): string[] {
  const words = message.toLowerCase().match(/[a-z0-9]{4,}/g) ?? []
  return [...new Set(words)].slice(0, 5)
}

export async function buildChatContext(admin: Admin, userId: string, page: ChatPage, message: string): Promise<ChatContext> {
  const words = keywords(message)
  const titleMatch = (col: string) => words.map(w => `${col}.ilike.%${w}%`).join(',')

  const { data: cycle } = await admin
    .from('cycles')
    .select('id, label, theme, status, meeting_at')
    .eq('status', 'open')
    .order('year', { ascending: false })
    .order('month', { ascending: false })
    .limit(1)
    .maybeSingle()

  const [current, older, mine] = await Promise.all([
    cycle
      ? admin.from('topics').select(TOPIC_COLUMNS).eq('cycle_id', cycle.id).eq('is_deleted', false).order('score', { ascending: false }).limit(MAX_TOPICS)
      : Promise.resolve({ data: [] as TopicRow[] }),
    words.length
      ? admin.from('topics').select(TOPIC_COLUMNS).eq('is_deleted', false).or(titleMatch('title')).order('created_at', { ascending: false }).limit(8)
      : Promise.resolve({ data: [] as TopicRow[] }),
    // The asker's own count, so the bot can say how many posts they have left.
    cycle
      ? admin.from('topics').select('id', { count: 'exact', head: true }).eq('cycle_id', cycle.id).eq('user_id', userId).eq('is_deleted', false).eq('is_carry_forward', false)
      : Promise.resolve({ count: null }),
  ])

  const seen = new Set<string>()
  const topics: ChatTopic[] = []
  for (const row of [...(current.data ?? []), ...(older.data ?? [])] as TopicRow[]) {
    if (seen.has(row.id)) continue
    seen.add(row.id)
    topics.push(toChatTopic(row))
  }

  const theme = cycle?.theme && typeof cycle.theme === 'object' && 'title' in cycle.theme ? String((cycle.theme as { title: unknown }).title) : null

  return {
    page: page.kind,
    month: cycle ? { label: cycle.label, theme, status: cycle.status, meetingAt: cycle.meeting_at } : null,
    postsLeft: cycle && typeof mine.count === 'number' ? Math.max(0, TOKEN_LIMITS.TOPICS_PER_CYCLE - mine.count) : null,
    topics,
    current: page.kind === 'topic' ? await currentTopic(admin, page.topicId) : null,
    bytes: await recentBytes(admin, words, page.kind === 'bytes' ? page.byteId : undefined),
    kinds: KINDS.map(k => ({ value: k.value, label: k.label, first: k.first.label, second: k.second.label })),
  }
}

/** The topic on screen and its latest comments, authors shown as the thread shows them. */
async function currentTopic(admin: Admin, topicId: string): Promise<ChatContext['current']> {
  const { data: topic } = await admin.from('topics').select(TOPIC_COLUMNS).eq('id', topicId).eq('is_deleted', false).maybeSingle()
  if (!topic) return null
  const t = topic as TopicRow

  const { data: comments } = await admin
    .from('comments')
    .select('user_id, body, is_anonymous, users!comments_user_id_fkey(username)')
    .eq('topic_id', topicId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(12)

  return {
    topic: toChatTopic(t),
    body: t.description.slice(0, 1500),
    comments: (comments ?? []).reverse().map(c => {
      const username = joinedUsername(c.users)
      const author = commentIsGhost(c, { id: t.id, user_id: t.user_id, is_anonymous: t.is_anonymous })
        ? ghostHandle(c.user_id, t.id)
        : isSystemUsername(username) ? 'GuildBot' : `@${username ?? 'someone'}`
      return { author, text: c.body.slice(0, 400) }
    }),
  }
}

/** The latest published Bytes, plus any whose titles match the message. */
async function recentBytes(admin: Admin, words: string[], pinnedId?: string): Promise<ChatByte[]> {
  const { data: digests } = await admin
    .from('byte_digests')
    .select('id')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(2)
  const digestIds = (digests ?? []).map(d => d.id)

  const columns = 'id, source_title, source_name, source, summary'
  const [latest, matched, pinned] = await Promise.all([
    digestIds.length ? admin.from('bytes').select(columns).in('digest_id', digestIds).order('position').limit(20) : Promise.resolve({ data: [] }),
    words.length && digestIds.length
      ? admin.from('bytes').select(`${columns}, byte_digests!inner(status)`).eq('byte_digests.status', 'published').or(words.map(w => `source_title.ilike.%${w}%`).join(',')).limit(6)
      : Promise.resolve({ data: [] }),
    pinnedId ? admin.from('bytes').select(`${columns}, byte_digests!inner(status)`).eq('id', pinnedId).eq('byte_digests.status', 'published').maybeSingle() : Promise.resolve({ data: null }),
  ])

  const out: ChatByte[] = []
  const seen = new Set<string>()
  for (const b of [pinned.data, ...(matched.data ?? []), ...(latest.data ?? [])]) {
    if (!b || seen.has(b.id)) continue
    seen.add(b.id)
    out.push({ id: b.id, title: b.source_title, source: b.source_name ?? b.source, summary: (b.summary ?? '').slice(0, 300) })
  }
  return out.slice(0, 24)
}
