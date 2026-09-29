/**
 * The system author's public identity. Shared (not server-only) so the
 * serializer and the UI can recognise a GuildBoard post from the author's
 * username alone, without depending on the `is_system` column existing.
 */
export const SYSTEM_USERNAME = 'guildboard'
export const SYSTEM_DISPLAY_NAME = 'GuildBoard'

/** Usernames people cannot claim, so nobody can pass as the system. */
export const RESERVED_USERNAMES = new Set([SYSTEM_USERNAME, 'guild_board', 'admin', 'system', 'skillrev'])
