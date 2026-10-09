// ROUTE: GET/POST/DELETE /api/guildbot/chat
// AUTH: signed-in members only (no guests)
// PURPOSE: Chat with GuildBot. GET your thread, POST a message, DELETE to clear.
// DB TABLES: guildbot_messages (+ reads for context, see chat-context.ts)
// RLS: service role, every query pinned to the session's user id. The table
//      has no member grants (032), so nobody can read anyone else's chat.

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { chat, CHAT_FALLBACK, type ChatAnswer, type ChatDraft } from '@guildboard/guildbot'
import { llm } from '@/lib/guildbot-host/llm'
import { SASS, botSays } from '@/lib/guildbot-host/voice'
import { buildChatContext, type ChatPage } from '@/lib/guildbot-host/chat-context'
import { KINDS } from '@/lib/kinds'
import { DESCRIPTION_MAX_LENGTH, TITLE_MAX_LENGTH } from '@/lib/constants'
import { parsePollInput } from '@/lib/polls'

// One model call, ~20s, plus up to 45s of retry on a busy model.
// Chat uses the bulk tier (see chat() in the package): the quality model's
// free quota is 20 requests a day, which GuildBot's comments need.
export const maxDuration = 120

const MESSAGE_MAX = 1500
/** Asks per member per rolling week. Keeps the chat a tool, not a hangout. */
const WEEKLY_LIMIT = 15
const HISTORY_SHOWN = 40
/** Same split as the share form: two answers and their headings share the description. */
const SECTION_MAX = Math.floor((DESCRIPTION_MAX_LENGTH - 60) / 2)

type Cite = { type: 'topic' | 'byte'; id: string; title: string }

async function session() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function GET() {
  if (!SASS) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const user = await session()
  if (!user) return NextResponse.json({ error: 'Sign in to chat with GuildBot' }, { status: 401 })

  const { data } = await createAdminClient()
    .from('guildbot_messages')
    .select('id, role, body, draft, cites, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(HISTORY_SHOWN)
  return NextResponse.json((data ?? []).reverse())
}

export async function DELETE() {
  if (!SASS) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const user = await session()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await createAdminClient().from('guildbot_messages').delete().eq('user_id', user.id)
  return NextResponse.json({ ok: true })
}

export async function POST(request: Request) {
  if (!SASS) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const user = await session()
  if (!user) return NextResponse.json({ error: 'Sign in to chat with GuildBot' }, { status: 401 })

  let body: { message?: unknown; page?: unknown }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }
  const message = typeof body.message === 'string' ? body.message.trim() : ''
  if (!message) return NextResponse.json({ error: 'Say something' }, { status: 400 })
  if (message.length > MESSAGE_MAX) return NextResponse.json({ error: `Keep it under ${MESSAGE_MAX} characters` }, { status: 400 })

  const admin = createAdminClient()

  const since = new Date(Date.now() - 7 * 86_400_000).toISOString()
  const { count: thisWeek } = await admin
    .from('guildbot_messages')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('role', 'user')
    .gte('created_at', since)
  if ((thisWeek ?? 0) >= WEEKLY_LIMIT) {
    const reply = botSays('chat.limit', user.id, 'chat', { limit: WEEKLY_LIMIT }) ?? `That's ${WEEKLY_LIMIT} asks this week. Back next week.`
    return NextResponse.json({ reply, draft: null, cites: [], limited: true })
  }

  const { data: earlier } = await admin
    .from('guildbot_messages')
    .select('role, body')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10)

  await admin.from('guildbot_messages').insert({ user_id: user.id, role: 'user', body: message })

  const context = await buildChatContext(admin, user.id, parsePage(body.page), message)
  const answer: ChatAnswer = (await chat(llm, {
    message,
    history: (earlier ?? []).reverse().map(m => ({ role: m.role as 'user' | 'bot', text: m.body })),
    context,
  })) ?? { reply: "My brain timed out. Try again in a minute.", draft: null, cites: [] }

  const draft = validDraft(answer.draft)
  const titles = new Map<string, Cite>([
    ...context.topics.map(t => [t.id, { type: 'topic', id: t.id, title: t.title }] as const),
    ...(context.current ? [[context.current.topic.id, { type: 'topic', id: context.current.topic.id, title: context.current.topic.title }] as const] : []),
    ...context.bytes.map(b => [b.id, { type: 'byte', id: b.id, title: b.title }] as const),
  ])
  const cites = answer.cites.map(id => titles.get(id)).filter((c): c is Cite => !!c)

  await admin.from('guildbot_messages').insert({ user_id: user.id, role: 'bot', body: answer.reply, draft, cites })
  return NextResponse.json({ reply: answer.reply, draft, cites, fallback: answer.reply === CHAT_FALLBACK })
}

function parsePage(raw: unknown): ChatPage {
  const p = (raw ?? {}) as { kind?: unknown; topicId?: unknown; byteId?: unknown }
  const uuid = (v: unknown) => (typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v) ? v : undefined)
  if (p.kind === 'topic' && uuid(p.topicId)) return { kind: 'topic', topicId: uuid(p.topicId)! }
  if (p.kind === 'bytes') return { kind: 'bytes', byteId: uuid(p.byteId) }
  return { kind: 'board' }
}

/** A draft the share form would accept, or null. The member still reviews and posts it. */
function validDraft(d: ChatDraft | null): ChatDraft | null {
  if (!d) return null
  if (!KINDS.some(k => k.value === d.kind)) return null
  if (!d.title || d.title.length > TITLE_MAX_LENGTH || !d.second || d.second.length > SECTION_MAX) return null
  const context = d.context.length > SECTION_MAX ? '' : d.context
  const poll = d.poll ? parsePollInput(d.poll) : null
  return { ...d, context, poll: poll && 'poll' in poll ? poll.poll : null }
}
