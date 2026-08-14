/**
 * Topic-domain classification, used to keep a digest broad.
 *
 * Without this the selector returns whatever scored highest, which in practice
 * means five AI headlines in a row. Bucketing lets us round-robin across areas
 * so the guild sees a spread.
 *
 * Deliberately keyword-based rather than LLM-classified: it runs before the
 * summarizer, costs nothing, and is inspectable when a story lands in an odd
 * bucket. Order matters, first match wins, so the more specific buckets sit
 * above the general ones.
 */

export const DOMAINS = [
  'ai',
  'web',
  'backend',
  'data',
  'security',
  'devtools',
  'systems',
  'practice',
] as const

export type Domain = (typeof DOMAINS)[number]

export const DOMAIN_LABELS: Record<Domain, string> = {
  ai: 'AI & ML',
  web: 'Web & Frontend',
  backend: 'Backend & Cloud',
  data: 'Data',
  security: 'Security',
  devtools: 'Dev Tools',
  systems: 'Systems & Languages',
  practice: 'Craft & Career',
}

/** Compact glyph per domain, for chips. */
export const DOMAIN_ICONS: Record<Domain, string> = {
  ai: '🧠',
  web: '🎨',
  backend: '☁️',
  data: '📊',
  security: '🔐',
  devtools: '🔧',
  systems: '⚙️',
  practice: '🧭',
}

const RULES: [Domain, RegExp][] = [
  ['security', /\b(security|vulnerab|exploit|cve|malware|breach|ransomware|phishing|zero.?day|cryptograph|encrypt|auth[nz]?|oauth|passkey|supply.chain)\b/i],
  ['ai', /\b(ai|a\.i\.|llm|gpt|claude|gemini|openai|anthropic|machine.learning|neural|transformer|diffusion|embedding|rag|agentic|inference|fine.?tun|prompt|copilot|model)\b/i],
  ['data', /\b(database|postgres|mysql|sqlite|redis|kafka|duckdb|clickhouse|analytics|data.?(warehouse|lake|pipeline)|etl|sql|query.plan|index(ing)?)\b/i],
  ['web', /\b(react|vue|svelte|angular|next\.?js|remix|astro|css|html|tailwind|browser|chrome|firefox|safari|webassembly|wasm|frontend|front.?end|ui|ux|design.system|accessib|a11y)\b/i],
  ['backend', /\b(kubernetes|k8s|docker|container|serverless|aws|gcp|azure|cloudflare|terraform|microservice|api|grpc|graphql|deploy|infra|devops|sre|observab|monitoring)\b/i],
  ['systems', /\b(rust|golang|\bgo\b|zig|c\+\+|kernel|linux|compiler|runtime|memory|concurren|performance|latency|garbage.collect|assembly|riscv|arm|cpu|gpu)\b/i],
  ['devtools', /\b(git|github|vscode|vim|neovim|emacs|terminal|shell|cli|build.(tool|system)|bundler|webpack|vite|lint|debugger|testing|ci\/cd|editor)\b/i],
  ['practice', /\b(career|hiring|interview|remote.work|burnout|productiv|management|team|culture|open.source|licensing|salary|freelanc|startup|writing|documentation)\b/i],
]

/**
 * Classify a story from its title (and optional excerpt).
 * Falls back to `devtools`, the broadest bucket, when nothing matches.
 */
export function classifyDomain(title: string, excerpt?: string | null): Domain {
  const text = `${title} ${excerpt ?? ''}`
  for (const [domain, pattern] of RULES) {
    if (pattern.test(text)) return domain
  }
  return 'devtools'
}

/**
 * Pick `limit` items while spreading them across domains.
 *
 * Round-robins one item per domain (each domain's list already sorted by
 * score) before taking a second from any domain, so a busy area cannot crowd
 * out the rest. Once every domain is exhausted the remainder fills by score.
 */
export function selectForBreadth<T extends { domain: Domain; score: number }>(
  items: T[],
  limit: number,
): T[] {
  if (limit <= 0) return []
  const byDomain = new Map<Domain, T[]>()
  for (const item of items) {
    const list = byDomain.get(item.domain) ?? []
    list.push(item)
    byDomain.set(item.domain, list)
  }
  for (const list of byDomain.values()) list.sort((a, b) => b.score - a.score)

  // Start with the domains holding the strongest single item, so a round-robin
  // never leads with a weak story just because its bucket happened to be first.
  const domains = [...byDomain.keys()].sort(
    (a, b) => (byDomain.get(b)![0]?.score ?? 0) - (byDomain.get(a)![0]?.score ?? 0),
  )

  const out: T[] = []
  for (let round = 0; out.length < limit; round++) {
    let added = false
    for (const domain of domains) {
      const item = byDomain.get(domain)![round]
      if (!item) continue
      out.push(item)
      added = true
      if (out.length >= limit) break
    }
    if (!added) break
  }
  return out
}

/**
 * Target share of a digest per medium.
 *
 * Breadth alone does not produce a mix: engineering blogs out-publish every
 * other source by an order of magnitude, so a purely score-ranked ten is ten
 * blog posts and the video and news sources may as well not be wired up. Each
 * medium therefore gets a floor, and the remainder fills by score.
 *
 * Articles still lead - they are the densest thing a guild can read before a
 * meeting - but a week now reliably carries a talk and a piece of reporting.
 */
const MIX: { source: string[]; share: number }[] = [
  { source: ['blog'], share: 0.5 },
  { source: ['news'], share: 0.2 },
  { source: ['video'], share: 0.2 },
  { source: ['hn'], share: 0.1 },
]

/**
 * Pick `limit` items spread across both medium and topic.
 *
 * Two passes. Each medium first takes its quota, chosen for topic breadth
 * within that medium; then whatever is left over fills any shortfall by score,
 * again spread across domains. A week where nobody published a video is
 * therefore a week with an extra article, not a short digest.
 */
export function selectMix<
  T extends { source: string; source_name?: string; domain: Domain; score: number },
>(items: T[], limit: number): T[] {
  if (limit <= 0) return []

  /* No publisher owns a medium. Observed on a live run before this cap
     existed: Cloudflare took four of the five article slots and one channel
     took both video slots, because those sources publish daily and every item
     within a medium carries a near-flat score, so the domain round-robin had
     nothing to break the tie with. Topic breadth does not imply source
     breadth - four Cloudflare posts about four different areas still reads as
     a Cloudflare newsletter.
     The cap is per medium rather than per digest: a third of the articles is a
     reasonable share for one company, while a third of two video slots is one
     video, which is exactly the intent. */
  const capFor = (quota: number) => Math.max(1, Math.ceil(quota / 3))

  const taken = new Set<T>()
  const buckets = MIX.map(({ source, share }) => {
    const quota = Math.max(1, Math.round(limit * share))
    const bucket = capPerPublisher(items.filter(i => source.includes(i.source)), capFor(quota))
    const chosen = selectForBreadth(bucket, quota)
    for (const item of chosen) taken.add(item)
    return chosen
  })

  // Interleave rather than concatenate, so the published order reads as a mix
  // instead of five blog posts followed by the videos nobody scrolled to.
  const picked: T[] = []
  for (let round = 0; ; round++) {
    let added = false
    for (const bucket of buckets) {
      const item = bucket[round]
      if (!item) continue
      picked.push(item)
      added = true
    }
    if (!added) break
  }

  /* Rounding every quota up can overshoot. Truncating the interleaved order is
     the right cut: round 0 holds the strongest item from each medium, so the
     items lost are the extra ones from whichever medium ran deepest. */
  if (picked.length > limit) return picked.slice(0, limit)

  if (picked.length < limit) {
    /* The shortfall fill respects the cap too, counting what each publisher
       already contributed above - otherwise a quiet week for video hands the
       spare slots straight back to whoever published most. */
    const used = new Map<string, number>()
    for (const item of picked) {
      const key = publisherKey(item)
      if (key) used.set(key, (used.get(key) ?? 0) + 1)
    }
    const rest = capPerPublisher(
      items.filter(i => !taken.has(i)),
      capFor(limit - picked.length),
      used,
    )
    picked.push(...selectForBreadth(rest, limit - picked.length))
  }

  return picked
}

function publisherKey(item: { source_name?: string }): string | null {
  const name = item.source_name?.trim().toLowerCase()
  return name ? name : null
}

/**
 * Keep at most `max` items per publisher, highest scoring first.
 *
 * Runs before selection rather than after, so the domain round-robin still
 * sees a full spread of topics and simply picks a different company's post for
 * the ones it drops. Items with no publisher are never capped: on Hacker News
 * the "publisher" is the linked hostname, which is naturally varied.
 */
function capPerPublisher<T extends { source_name?: string; score: number }>(
  items: T[],
  max: number,
  used: Map<string, number> = new Map(),
): T[] {
  const seen = new Map(used)
  const out: T[] = []
  for (const item of [...items].sort((a, b) => b.score - a.score)) {
    const key = publisherKey(item)
    if (!key) {
      out.push(item)
      continue
    }
    const count = seen.get(key) ?? 0
    if (count >= max) continue
    seen.set(key, count + 1)
    out.push(item)
  }
  return out
}
