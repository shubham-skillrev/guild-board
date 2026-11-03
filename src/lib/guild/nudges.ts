import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { aiJson } from '@/lib/ai'
import { NUDGE_MAX, type Person } from '@/lib/people'

/**
 * Nudges: a short note from an organiser to one person, drafted by Kers.
 *
 * Kers drafts from what the person told the guild themselves (their survey
 * answers) and what they did under their own name. Never from visits, never
 * from activity levels, never anything anonymous: a note that says "we
 * noticed you haven't been around" reads as surveillance, not an invitation.
 */

const SITE = 'https://guildboard.skillrev.in'

/** What Kers may know about one person. No visits, no ghost activity. */
function draftFacts(p: Person) {
  return {
    key: p.key,
    first_name: p.name.replace(/^@/, '').split(/\s+/)[0],
    has_account: p.member,
    posts_under_their_name: p.namedPosts,
    has_demoed: p.demos > 0,
    survey: p.survey
      ? {
          could_show_something: p.survey.demo,
          what_they_would_show: p.survey.demoIdea,
          want_to_learn: p.survey.learnNext,
          nominated_someone: !!p.survey.nominated,
        }
      : null,
  }
}

const SYSTEM = [
  'You draft short notes from a SkillRev guild organiser to one colleague, to invite',
  'them into the monthly engineering guild (devs, DevOps, QA, PMs, scrum masters).',
  'The organiser edits and sends the note under their own name, so write as them:',
  'first person, warm, plain, like a Slack DM to a colleague. English only.',
  '',
  'Each note: 2 or 3 sentences, under 280 characters, one clear ask.',
  '- Build it on what the person told us: what they would show, what they want to',
  '  learn. If they said they could show something, ask them to take a demo slot.',
  '  If they want to learn something, mention the guild is a good place to ask.',
  '- If has_account is false, invite them to join (the link is added for you).',
  '- Never mention visits, activity, how often they come, being quiet or missing,',
  '  tracking, levels, or numbers about them. Never guilt, never pressure.',
  '- No sign-off, no emoji, no links.',
].join('\n')

export interface Draft {
  key: string
  body: string
  byAi: boolean
}

/** Written fallback, by what we know about them. */
function fallbackDraft(p: Person): string {
  const first = p.name.replace(/^@/, '').split(/\s+/)[0]
  if (!p.member) {
    return p.survey?.demoIdea
      ? `Hi ${first}, thanks for the survey! You mentioned you could show "${p.survey.demoIdea}". Join the guild and grab a demo slot, it would be great to see.`
      : `Hi ${first}, thanks for answering the guild survey! Come join us on GuildBoard, it takes one tap with your SkillRev Google account.`
  }
  if (p.survey?.demoIdea) return `Hi ${first}, you said in the survey you could show "${p.survey.demoIdea}". Want to take the demo slot at the next meeting? Ten minutes, no slides.`
  if (p.survey?.learnNext) return `Hi ${first}, you wanted to learn about ${p.survey.learnNext}. Drop it on the board as a topic, I bet others want it too.`
  return `Hi ${first}, the guild board is open for this month's topics. Is there something you've been wanting to talk about? Post it, even half-formed.`
}

function withLink(p: Person, body: string): string {
  if (p.member) return body
  const first = p.name.replace(/^@/, '').split(/\s+/)[0]
  return `${body} ${SITE}/join?n=${encodeURIComponent(first)}`
}

/** Kers' drafts for a set of people, one AI call for all of them. */
export async function draftNudges(people: Person[]): Promise<Draft[]> {
  if (!people.length) return []
  const result = await aiJson<{ items?: { key?: unknown; message?: unknown }[] }>({
    label: 'kers: nudge drafts',
    tier: 'bulk',
    system: SYSTEM,
    prompt: `Draft one note for each person.\n\n${JSON.stringify(people.map(draftFacts), null, 2)}`,
    schema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              key: { type: 'string', description: 'Echo the key exactly.' },
              message: { type: 'string', description: 'The note, under 280 characters, no links.' },
            },
            required: ['key', 'message'],
          },
        },
      },
      required: ['items'],
    },
  }).catch(() => null)

  const byKey = new Map<string, string>()
  for (const item of result?.items ?? []) {
    if (typeof item.key !== 'string' || typeof item.message !== 'string') continue
    const msg = item.message.replace(/https?:\/\/\S+/g, '').replace(/\s+/g, ' ').trim()
    if (msg && msg.length <= 320) byKey.set(item.key, msg)
  }
  return people.map(p => {
    const ai = byKey.get(p.key)
    return { key: p.key, body: withLink(p, ai ?? fallbackDraft(p)).slice(0, NUDGE_MAX), byAi: !!ai }
  })
}

export interface NudgeLogRow {
  id: string
  name: string
  channel: string
  body: string
  sentAt: string
  sentBy: string | null
  segment: string | null
  /** Posted, commented, voted, volunteered or (no account) joined within 7 days. */
  acted: boolean
}

/** The last 60 nudges and whether each one led anywhere within a week. */
export async function getNudgeLog(): Promise<NudgeLogRow[]> {
  const admin = createAdminClient()
  const { data: nudges } = await admin
    .from('nudges')
    .select('id, user_id, email, channel, body, segment, sent_at, sender:users!nudges_sent_by_fkey(username), person:users!nudges_user_id_fkey(username, real_name)')
    .order('sent_at', { ascending: false })
    .limit(60)
  if (!nudges?.length) return []

  const oldest = nudges[nudges.length - 1].sent_at
  const [{ data: topics }, { data: comments }, { data: votes }, { data: demos }, { data: users }, { data: survey }] = await Promise.all([
    admin.from('topics').select('user_id, created_at').gte('created_at', oldest),
    admin.from('comments').select('user_id, created_at').gte('created_at', oldest),
    admin.from('votes').select('user_id, created_at').gte('created_at', oldest),
    admin.from('demos').select('user_id, created_at').gte('created_at', oldest),
    admin.from('users').select('email, created_at').gte('created_at', oldest),
    admin.from('survey_responses').select('email, name'),
  ])
  const acts = [...(topics ?? []), ...(comments ?? []), ...(votes ?? []), ...(demos ?? [])]
  const names = new Map((survey ?? []).map(s => [s.email, s.name]))

  return nudges.map(n => {
    const from = new Date(n.sent_at).getTime()
    const within = (at: string) => { const t = new Date(at).getTime(); return t >= from && t <= from + 7 * 86_400_000 }
    const acted = n.user_id
      ? acts.some(a => a.user_id === n.user_id && within(a.created_at))
      : (users ?? []).some(u => (u.email ?? '').toLowerCase() === n.email && within(u.created_at))
    const person = n.person as unknown as { username: string; real_name: string | null } | null
    return {
      id: n.id,
      name: person ? person.real_name || `@${person.username}` : names.get(n.email) ?? n.email,
      channel: n.channel,
      body: n.body,
      sentAt: n.sent_at,
      sentBy: (n.sender as unknown as { username: string } | null)?.username ?? null,
      segment: n.segment,
      acted,
    }
  })
}

