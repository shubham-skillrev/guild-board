// ROUTE: GET/POST/DELETE /api/guildbot/chat
// AUTH: signed-in members only (no guests)
// PURPOSE: Chat with GuildBot. GET your thread, POST a message, DELETE to clear.
// DB TABLES: guildbot_messages (+ reads for context, see chat-context.ts)
// RLS: service role, every query pinned to the session's user id. The table
//      has no member grants (032), so nobody can read anyone else's chat.

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { chat, CHAT_FALLBACK, type ChatAnswer, type ChatContext, type ChatDraft } from '@guildboard/guildbot'
import { llm } from '@/lib/guildbot-host/llm'
import { SASS, botSays } from '@/lib/guildbot-host/voice'
import { buildChatContext, type ChatPage } from '@/lib/guildbot-host/chat-context'
import { KINDS } from '@/lib/kinds'
import { DESCRIPTION_MAX_LENGTH, TITLE_MAX_LENGTH } from '@/lib/constants'
import { parsePollInput } from '@/lib/polls'
import { asksFor, WEEKLY_LIMIT } from '@/lib/guildbot-host/asks'

// One model call, ~20s; up to three models when the first is busy (src/lib/ai).
// Chat uses the bulk tier (see chat() in the package): the quality model's
// free quota is 20 requests a day, which GuildBot's comments need.
export const maxDuration = 120

const MESSAGE_MAX = 1500
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
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(HISTORY_SHOWN)
  // Every column (so it works before and after migration 035), minus the owner.
  return NextResponse.json((data ?? []).reverse().map(({ user_id: _owner, ...m }) => m))
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

  let body: { message?: unknown; page?: unknown; yourself?: unknown }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }
  const message = typeof body.message === 'string' ? body.message.trim() : ''
  if (!message) return NextResponse.json({ error: 'Say something' }, { status: 400 })
  if (message.length > MESSAGE_MAX) return NextResponse.json({ error: `Keep it under ${MESSAGE_MAX} characters` }, { status: 400 })

  const admin = createAdminClient()

  const before = await asksFor(admin, user.id)
  if (before.left === 0) {
    const reply = botSays('chat.limit', user.id, 'chat', { limit: WEEKLY_LIMIT }) ?? `That's ${WEEKLY_LIMIT} asks this week. Back next week.`
    return NextResponse.json({ reply, draft: null, cites: [], limited: true, asks: before })
  }

  const { data: earlier } = await admin
    .from('guildbot_messages')
    .select('role, body')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10)

  await admin.from('guildbot_messages').insert({ user_id: user.id, role: 'user', body: message })

  const context = { ...(await buildChatContext(admin, user.id, parsePage(body.page), message)), yourself: parseYourself(body.yourself) }
  const answer: ChatAnswer = (await chat(llm, {
    message,
    history: (earlier ?? []).reverse().map(m => ({ role: m.role as 'user' | 'bot', text: m.body })),
    context,
  })) ?? { reply: "My brain timed out. Try again in a minute.", draft: null, cites: [], reaction: null }

  const draft = validDraft(answer.draft)
  const titles = new Map<string, Cite>([
    ...context.topics.map(t => [t.id, { type: 'topic', id: t.id, title: t.title }] as const),
    ...(context.current ? [[context.current.topic.id, { type: 'topic', id: context.current.topic.id, title: context.current.topic.title }] as const] : []),
    ...context.bytes.map(b => [b.id, { type: 'byte', id: b.id, title: b.title }] as const),
  ])
  const cites = answer.cites.map(id => titles.get(id)).filter((c): c is Cite => !!c)

  const row = { user_id: user.id, role: 'bot', body: answer.reply, draft, cites }
  const saved = await admin.from('guildbot_messages').insert({ ...row, reaction: answer.reaction })
  // Before migration 035 there's no reaction column: keep the reply, drop the sticker.
  if (saved.error) await admin.from('guildbot_messages').insert(row)
  // This ask is already saved, so the window now counts it.
  const asks = await asksFor(admin, user.id)
  return NextResponse.json({ reply: answer.reply, draft, cites, reaction: answer.reaction, fallback: answer.reply === CHAT_FALLBACK, asks })
}

const DOING = new Set(['sleeping', 'waking up', 'brushing his teeth', 'having coffee', 'coding', 'having lunch', 'out for a walk', 'sitting in the garden, too hot to walk', 'watching the rain with chai', 'reading a book', 'listening to music', 'meditating', 'sulking about the meeting', 'focusing with this person', 'on a break with this person'])
const WEARING = new Set(['sunglasses', 'sweating', 'beanie', 'scarf', 'umbrella'])

/** What the browser says GuildBot is doing and wearing: known values only, so it can't carry anything else to the model. */
function parseYourself(raw: unknown): ChatContext['yourself'] {
  const y = (raw ?? {}) as { doing?: unknown; weather?: unknown; wearing?: unknown }
  if (typeof y.doing !== 'string' || !DOING.has(y.doing)) return null
  const weather = typeof y.weather === 'string' && /^[\p{L}\p{M} .,'-]{2,60}, -?\d{1,2}°C, [a-z ]{3,20}$/u.test(y.weather) ? y.weather : null
  const wearing = Array.isArray(y.wearing) ? y.wearing.filter((w): w is string => typeof w === 'string' && WEARING.has(w)) : []
  return { doing: y.doing, weather, wearing }
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
