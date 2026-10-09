-- ============================================================
-- Migration 030: Who may use the live channels
-- ============================================================
--
-- The board and topic pages listen on private Supabase Broadcast channels,
-- board:{cycle_id} and topic:{topic_id} (src/lib/realtime/channels.ts).
-- Private channels are authorised by RLS on realtime.messages:
--
--   * Members and guests may LISTEN to both. Payloads are counts and a list
--     of what changed; nothing identifies a person (ghost authors included),
--     because the server builds them from sanitized reads. Guests browse with
--     the anon key, so anon is included on purpose.
--   * Nobody but the service role may SEND a broadcast. The server publishes
--     after each write; without this a member could forge counts or events.
--   * Members and guests may join PRESENCE on a topic channel, which powers
--     "N here now". The client tracks an empty object under a random key, so
--     presence carries no identity either.
--
-- The service role bypasses RLS, which is how the server sends.
-- If this migration is missing, private channels refuse to join and the
-- pages fall back to polling every 15s.

CREATE POLICY "guildboard_live_listen" ON realtime.messages
  FOR SELECT
  TO anon, authenticated
  USING (
    realtime.messages.extension IN ('broadcast', 'presence')
    AND (realtime.topic() LIKE 'board:%' OR realtime.topic() LIKE 'topic:%')
  );

CREATE POLICY "guildboard_live_presence" ON realtime.messages
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    realtime.messages.extension = 'presence'
    AND realtime.topic() LIKE 'topic:%'
  );
