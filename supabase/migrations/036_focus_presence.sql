-- ============================================================
-- Migration 036: Who's focusing right now
-- ============================================================
--
-- /focus shows how many members have a focus timer running right now,
-- wherever they are in the app, as a little crowd of anonymous plushes. Each
-- browser joins the presence of one private channel, focus:guild, under a
-- random key, carrying only:
--
--   { s: 'focus' | 'break', since: <rounded ms>, look: 0..99 }
--
-- No user id, no name, no timer length: it says "someone is focusing" and
-- nothing about who. Members only: guests (the anon role) can neither listen
-- nor join.
--
-- Without it /focus still works; the count just stays at you.

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
