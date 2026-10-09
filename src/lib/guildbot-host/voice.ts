import { guard, line, type LineKey, type Surface } from '@guildboard/guildbot'

/**
 * GuildBot's voice in the app. The one switch for all of it:
 * NEXT_PUBLIC_GUILDBOT_SASS=0 puts every surface back on the plain copy.
 * Public on purpose (it is not a secret) so server and browser agree.
 * Like any env change on Vercel, flipping it needs a redeploy.
 */
export const SASS = process.env.NEXT_PUBLIC_GUILDBOT_SASS !== '0'

/**
 * A guarded GuildBot line, or null to fall back to the plain copy. Null when
 * the voice is switched off, when no line can be filled from `vars`, or when
 * the filled line fails the guard for `surface` (too long for a push, say).
 */
export function botSays(
  key: LineKey,
  seed: string,
  surface: Surface,
  vars: Record<string, string | number> = {},
): string | null {
  if (!SASS) return null
  const text = line(key, seed, vars)
  if (!text) return null
  const checked = guard(text, { surface })
  return checked.ok ? checked.text : null
}

/** How the bot signs a line in a shared channel, so nobody mistakes it for a person. */
export const BOT_MARK = '◈'
