/**
 * The system author's public identity: GuildBot. Shared (not server-only) so
 * the serializer and the UI can recognise a GuildBot post from the author's
 * username alone, without depending on the `is_system` column existing.
 */
export const SYSTEM_USERNAME = 'guildbot'
export const SYSTEM_DISPLAY_NAME = 'GuildBot'

/** The account's username before it was renamed (migration 026). Still
    recognised, so its posts stay marked as GuildBot's until that runs. */
const LEGACY_SYSTEM_USERNAMES = ['guildboard']

export function isSystemUsername(username: string | null | undefined): boolean {
  return !!username && (username === SYSTEM_USERNAME || LEGACY_SYSTEM_USERNAMES.includes(username))
}

/** Usernames people cannot claim, so nobody can pass as the system. */
export const RESERVED_USERNAMES = new Set([
  SYSTEM_USERNAME, ...LEGACY_SYSTEM_USERNAMES, 'guild_bot', 'guild_board', 'admin', 'system', 'skillrev',
])
