import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { KINDS, composeDescription, type Kind } from '@/lib/kinds'
import { TITLE_MAX_LENGTH, DESCRIPTION_MAX_LENGTH } from '@/lib/constants'
import { SYSTEM_USERNAME } from '@/lib/system/identity'
import { notifyOnSystemTopics } from '@/lib/push/notify'

/**
 * GuildBoard as an author.
 *
 * Once a month the system suggests a few things worth discussing that nobody
 * has brought yet. They are ordinary posts on the board: people vote, react
 * and reply exactly as they would on anyone else's. The system only
 * suggests; the guild decides.
 *
 * The author is a real account (topics.user_id -> users -> auth.users), made
 * through the Supabase Admin API with no password, so it can never sign in.
 * Migration 025 adds the `is_system` flags and lets it post more than once
 * per cycle.
 */

const SYSTEM_EMAIL = 'guildboard@skillrev.dev'

export interface SystemTopicDraft {
  kind: Kind
  title: string
  /** The kind's second answer, e.g. "What's interesting" for new tech. */
  why: string
  sources: { name: string; url: string }[]
}

type Admin = ReturnType<typeof createAdminClient>

/** The system user's id, creating the account on first use. */
export async function ensureSystemUser(admin: Admin = createAdminClient()): Promise<string> {
  const { data: existing } = await admin
    .from('users')
    .select('id')
    .eq('is_system', true)
    .limit(1)
    .maybeSingle()
  if (existing) return existing.id

  // An auth account may already exist from an earlier, half-finished run.
  let authId: string | undefined
  const created = await admin.auth.admin.createUser({
    email: SYSTEM_EMAIL,
    email_confirm: true,
    user_metadata: { full_name: 'GuildBoard' },
    app_metadata: { system: true },
  })
  if (created.data.user) {
    authId = created.data.user.id
  } else {
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 })
    authId = list?.users.find(u => u.email === SYSTEM_EMAIL)?.id
  }
  if (!authId) throw new Error(`Could not create the system account: ${created.error?.message ?? 'unknown error'}`)

  const { error } = await admin.from('users').upsert({
    id: authId,
    email: SYSTEM_EMAIL,
    username: SYSTEM_USERNAME,
    real_name: 'GuildBoard',
    is_system: true,
  })
  if (error) throw new Error(`Could not create the system user row: ${error.message}`)
  return authId
}

/** Markdown links, one per source. Parentheses in URLs are escaped so they
    do not end the link early (Wikipedia titles often contain them). */
function sourcesLine(sources: SystemTopicDraft['sources']): string {
  const links = sources
    .filter(s => /^https:\/\//.test(s.url))
    .map(s => `[${s.name.replace(/[[\]]/g, '')}](${s.url.replace(/\(/g, '%28').replace(/\)/g, '%29')})`)
  return links.length ? `Sources: ${links.join(' · ')}` : ''
}

function toDescription(draft: SystemTopicDraft): string {
  const kind = KINDS.find(k => k.value === draft.kind) ?? KINDS[2]
  const body = composeDescription(kind, draft.why, sourcesLine(draft.sources))
  return body.length > DESCRIPTION_MAX_LENGTH ? body.slice(0, DESCRIPTION_MAX_LENGTH - 1) + '…' : body
}

/**
 * Post drafts into a cycle as GuildBoard. Skips any whose title is already
 * on this cycle's board, so a re-run never duplicates. Returns what was
 * posted.
 */
export async function postSystemTopics(cycleId: string, drafts: SystemTopicDraft[]) {
  const admin = createAdminClient()
  const systemId = await ensureSystemUser(admin)

  const { data: current } = await admin
    .from('topics')
    .select('title')
    .eq('cycle_id', cycleId)
    .eq('is_deleted', false)
  const taken = new Set((current ?? []).map(t => t.title.trim().toLowerCase()))

  const rows = drafts
    .map(d => ({ ...d, title: d.title.trim().slice(0, TITLE_MAX_LENGTH) }))
    .filter(d => d.title && !taken.has(d.title.toLowerCase()))
    .map(d => ({
      cycle_id: cycleId,
      user_id: systemId,
      title: d.title,
      description: toDescription(d),
      category: d.kind,
      is_anonymous: false,
      is_system: true,
    }))

  if (rows.length === 0) return []
  const { data, error } = await admin.from('topics').insert(rows).select('id, title')
  if (error) throw new Error(`Could not post system topics: ${error.message}`)
  return data ?? []
}

/** How many system posts a cycle already has. The monthly job posts once. */
export async function countSystemTopics(cycleId: string): Promise<number> {
  const admin = createAdminClient()
  const { count } = await admin
    .from('topics')
    .select('id', { count: 'exact', head: true })
    .eq('cycle_id', cycleId)
    .eq('is_system', true)
    .eq('is_deleted', false)
  return count ?? 0
}

/**
 * Post drafts and announce them: one Slack message and one push, listing
 * every topic with its link, description and sources. Shared by the monthly
 * job and the admin "Suggest topics" button.
 */
export async function publishSystemTopics(
  cycle: { id: string; label: string },
  drafts: SystemTopicDraft[],
) {
  const posted = await postSystemTopics(cycle.id, drafts)
  if (posted.length) {
    const byTitle = new Map(drafts.map(d => [d.title.trim().slice(0, TITLE_MAX_LENGTH).toLowerCase(), d]))
    await notifyOnSystemTopics({
      label: cycle.label,
      topics: posted.map(p => {
        const d = byTitle.get(p.title.toLowerCase())
        return { id: p.id, title: p.title, why: d?.why, sources: d?.sources }
      }),
    })
  }
  return posted
}

/**
 * Drafts that come back from the admin's browser are untrusted input: keep
 * only well-formed ones, with https sources and sane lengths.
 */
export function sanitizeDrafts(raw: unknown): SystemTopicDraft[] {
  if (!Array.isArray(raw)) return []
  const kinds = new Set(KINDS.map(k => k.value))
  return raw.flatMap(item => {
    if (!item || typeof item !== 'object') return []
    const d = item as Record<string, unknown>
    const kind = typeof d.kind === 'string' && kinds.has(d.kind as Kind) ? (d.kind as Kind) : null
    const title = typeof d.title === 'string' ? d.title.trim().slice(0, TITLE_MAX_LENGTH) : ''
    const why = typeof d.why === 'string' ? d.why.trim().slice(0, 900) : ''
    const sources = (Array.isArray(d.sources) ? d.sources : [])
      .filter((s): s is { name: string; url: string } =>
        !!s && typeof s === 'object' &&
        typeof (s as Record<string, unknown>).name === 'string' &&
        typeof (s as Record<string, unknown>).url === 'string' &&
        /^https:\/\//.test((s as Record<string, string>).url))
      .slice(0, 3)
      .map(s => ({ name: s.name.slice(0, 80), url: s.url.slice(0, 500) }))
    return kind && title && why ? [{ kind, title, why, sources }] : []
  })
}
