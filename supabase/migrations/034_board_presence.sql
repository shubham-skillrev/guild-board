-- ============================================================
-- Migration 034: Presence on the board channel
-- ============================================================
--
-- 030 let members and guests join presence on topic:* channels only ("N here
-- now" on a topic). GuildBot's character now reacts to who is on the board
-- as a whole: a crowd arriving, or you being the only one there. Same rules
-- as topics: each tab tracks an empty object under a random key, so presence
-- carries a count and nothing about who.
--
-- Without it the board still joins its channel and gets live updates; the
-- presence track is refused, so GuildBot never notices a crowd.

DROP POLICY IF EXISTS "guildboard_live_presence" ON realtime.messages;

CREATE POLICY "guildboard_live_presence" ON realtime.messages
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    realtime.messages.extension = 'presence'
    AND (realtime.topic() LIKE 'topic:%' OR realtime.topic() LIKE 'board:%')
  );
