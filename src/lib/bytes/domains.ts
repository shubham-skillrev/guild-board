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
