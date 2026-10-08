import { KINDS, type Kind } from '@/lib/kinds'

/**
 * A month's theme: the words the board, the landing page, the share form and
 * the cycle-open message use, and the post kind it puts first.
 *
 * Stored per cycle in `cycles.theme` (migration 026), so a past month keeps
 * the theme it ran with. Null is a plain month: neutral copy, no "This month"
 * section on the landing page. Board mechanics are not part of a theme; see
 * FOCUS_FORMAT in src/lib/experiment.ts.
 *
 * Free of server-only imports: the board and the admin form read it too.
 */
export interface CycleTheme {
  /** Catalog slug (src/lib/themes/catalog.ts), so autopilot never repeats one.
      Absent on a theme written by hand or by Gemini. */
  id?: string
  /** Short name for the admin list, e.g. "Problem Month". */
  name: string
  /** Landing headline, e.g. "Bring a problem." */
  title: string
  /** One word of `title` set in the display italic. Optional. */
  accent?: string
  /** Under the board title, after the month label. */
  subtitle: string
  /** The landing page paragraph: what to bring and why. */
  blurb: string
  /** The share button's label, e.g. "Share a problem". */
  cta: string
  /** The kind the share form opens on, tagged "this month". */
  featured_kind: Kind
  /** Body of the cycle-open push and the line in its Slack message. */
  open_line: string
}

export const THEME_LIMITS = {
  name: 40,
  title: 60,
  accent: 24,
  subtitle: 80,
  blurb: 320,
  cta: 32,
  open_line: 140,
} as const

const KIND_VALUES = new Set<string>(KINDS.map(k => k.value))

/**
 * Anything claiming to be a theme (Gemini output, the admin's browser, a row)
 * is checked here. Every text field is required except `accent`, which is
 * dropped unless it actually appears in the title.
 */
export function sanitizeTheme(raw: unknown): CycleTheme | null {
  if (!raw || typeof raw !== 'object') return null
  const t = raw as Record<string, unknown>
  const text = (key: keyof typeof THEME_LIMITS) =>
    typeof t[key] === 'string' ? (t[key] as string).replace(/\s+/g, ' ').trim().slice(0, THEME_LIMITS[key]) : ''

  const theme = {
    name: text('name'),
    title: text('title'),
    subtitle: text('subtitle'),
    blurb: text('blurb'),
    cta: text('cta'),
    open_line: text('open_line'),
  }
  if (Object.values(theme).some(v => !v)) return null

  const kind = typeof t.featured_kind === 'string' && KIND_VALUES.has(t.featured_kind) ? (t.featured_kind as Kind) : null
  if (!kind) return null

  const accent = text('accent')
  const id = typeof t.id === 'string' && /^[a-z0-9-]{1,48}$/.test(t.id) ? t.id : null
  return {
    ...(id ? { id } : {}),
    ...theme,
    featured_kind: kind,
    ...(accent && theme.title.toLowerCase().includes(accent.toLowerCase()) ? { accent } : {}),
  }
}

/** The share button. A plain month invites anything. */
export function shareLabel(theme: CycleTheme | null | undefined): string {
  return theme?.cta ?? 'Share something'
}

/** The kind the share form opens on. */
export function defaultKind(theme: CycleTheme | null | undefined): Kind {
  return theme?.featured_kind ?? 'learned'
}

/** "October 2026 · This month's theme: bring a problem", or just the label. */
export function boardSubtitle(cycle: { label: string; theme?: CycleTheme | null }): string {
  return cycle.theme ? `${cycle.label} · ${cycle.theme.subtitle}` : cycle.label
}
