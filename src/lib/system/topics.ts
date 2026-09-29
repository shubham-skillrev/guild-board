import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { KINDS, composeDescription, type Kind } from '@/lib/kinds'
import { TITLE_MAX_LENGTH, DESCRIPTION_MAX_LENGTH } from '@/lib/constants'
import { SYSTEM_USERNAME } from '@/lib/system/identity'

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
