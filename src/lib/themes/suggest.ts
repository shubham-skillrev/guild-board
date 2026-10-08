import 'server-only'
import { geminiJson } from '@/lib/ai/gemini'
import { KINDS } from '@/lib/kinds'
import { sanitizeTheme, THEME_LIMITS, type CycleTheme } from '@/lib/themes'

const COUNT = 3

const SCHEMA = {
  type: 'object',
  properties: {
    themes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: `Short theme name, at most ${THEME_LIMITS.name} characters. e.g. "Problem Month".` },
          title: { type: 'string', description: `Landing headline, an imperative, at most ${THEME_LIMITS.title} characters. e.g. "Bring a problem."` },
          accent: { type: 'string', description: 'One word copied exactly from title, the one to emphasise.' },
          subtitle: { type: 'string', description: `Shown under the board title, at most ${THEME_LIMITS.subtitle} characters. e.g. "This month's theme: bring a problem".` },
          blurb: { type: 'string', description: `2-3 sentences, at most ${THEME_LIMITS.blurb} characters: what to bring, with two or three concrete examples, and why it makes a good hour.` },
          cta: { type: 'string', description: `Share button label, 2-4 words, at most ${THEME_LIMITS.cta} characters. e.g. "Share a problem".` },
          featured_kind: {
            type: 'string',
            enum: KINDS.map(k => k.value),
            description: KINDS.map(k => `${k.value}: ${k.heading.toLowerCase()}`).join('; '),
          },
          open_line: { type: 'string', description: `The month-open notification, one or two sentences, at most ${THEME_LIMITS.open_line} characters.` },
        },
        required: ['name', 'title', 'accent', 'subtitle', 'blurb', 'cta', 'featured_kind', 'open_line'],
      },
    },
  },
  required: ['themes'],
}

const SYSTEM = `You pick the monthly theme for SkillRev's engineering guild: about thirty software engineers who meet for an hour each month to talk tech. Members post one thing each to a shared board before the meeting, and the meeting is built from what people relate to most.

A theme is a prompt for what to bring that month. It should lower the bar to posting (anyone can answer it in two lines), lead to a good conversation, and differ from recent months. Each theme features one post kind: ${KINDS.map(k => `${k.value} (${k.label})`).join(', ')}.

Tone: English, dev-native, a little funny, never cutesy. Playful about the craft, precise about what to bring. No hype words, no exclamation marks, no em dashes, no emojis.

Return ${COUNT} themes that are clearly different from each other.`

/**
 * Three theme options for a month, for the admin to pick from or edit.
 * Returns [] when Gemini is unavailable or nothing usable came back.
 */
export async function suggestThemes(args: {
  monthLabel: string
  pastThemes: { label: string; theme: CycleTheme }[]
  brief?: string
}): Promise<CycleTheme[]> {
  const past = args.pastThemes
    .map(p => `- ${p.label}: ${p.theme.name} ("${p.theme.title}", features ${p.theme.featured_kind})`)
    .join('\n')

  const result = await geminiJson<{ themes?: unknown[] }>({
    label: 'themes',
    system: SYSTEM,
    prompt: `The theme is for ${args.monthLabel}.

Recent themes (do not repeat them):
${past || '- (none yet)'}
${args.brief ? `\nThe admin's direction for this month: ${args.brief}\n` : ''}`,
    schema: SCHEMA,
  })

  return (result?.themes ?? [])
    .map(sanitizeTheme)
    .filter((t): t is CycleTheme => !!t)
    .slice(0, COUNT)
}
