-- ============================================================
-- Migration 036: The focus building's lit windows
-- ============================================================
--
-- /focus draws the guild building with one lit window per member whose focus
-- timer is running, wherever they are in the app. Each browser joins the
-- presence of one private channel, focus:guild, under a random key, carrying
-- only what the window needs:
--
--   { s: 'focus' | 'break', since: <rounded ms>, look: 0..99 }
--
-- No user id, no name, no timer length: a window says "someone is focusing"
-- and nothing about who. Members only: guests (the anon role) can neither
-- listen nor join, so the building is the guild's.
--
-- Without it /focus still works; your own window lights up and the rest of
-- the building stays dark.

DROP POLICY IF EXISTS "guildboard_focus_listen" ON realtime.messages;
DROP POLICY IF EXISTS "guildboard_focus_presence" ON realtime.messages;

CREATE POLICY "guildboard_focus_listen" ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    realtime.messages.extension = 'presence'
    AND realtime.topic() = 'focus:guild'
  );

CREATE POLICY "guildboard_focus_presence" ON realtime.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    realtime.messages.extension = 'presence'
    AND realtime.topic() = 'focus:guild'
  );
