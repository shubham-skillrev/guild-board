-- ============================================================
-- Migration 035: GuildBot's reaction stickers
-- ============================================================
--
-- In the chat GuildBot sometimes puts a small sticker on what you wrote
-- (noted, heart, ooh...). It's saved on his reply row, the one that answers
-- your message, so it survives a reload, and it goes when the chat does
-- (wiped on meeting day, like every row in guildbot_messages).
--
-- Without this migration the chat still works: replies save without a
-- sticker and the sticker only shows until you reload.

ALTER TABLE public.guildbot_messages
  ADD COLUMN reaction text
  CHECK (reaction IN ('noted', 'bold', 'ooh', 'heart', 'eyeroll', 'mindblown', 'salute', 'same'));
