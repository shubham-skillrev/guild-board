-- ============================================================
-- Migration 049: The slide editor
-- ============================================================
--
-- Meeting mode v2, Batch 3 (docs/08-meeting-mode-v2.md): admins edit the
-- slides inside Preview slides (/meet/present?rehearse=1), with autosave,
-- undo, and "Reset to Kers draft".
--
--   meetings.agenda_draft  Kers' first draft of the month's slides, kept so
--                          the editor can go back to it. Written when Kers
--                          builds the agenda ("Build from the board",
--                          draft_agenda), or, for an agenda that was already
--                          there, the agenda as it stood just before the
--                          editor's first save. Never shown to phones.
--
--   storage bucket         `meeting-memes`: images an admin uploads for a meme
--                          slide. Public read (the shared screen and every
--                          phone load them by URL); only the service role
--                          writes (POST /api/admin/meeting/meme, admins only),
--                          so no storage policies are added. 4 MB, png / jpeg
--                          / gif / webp.
--
-- Additive. Until it's applied the editor still edits and saves, but "Reset
-- to Kers draft" and meme uploads say this migration is missing.

ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS agenda_draft jsonb CHECK (agenda_draft IS NULL OR jsonb_typeof(agenda_draft) = 'array');

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('meeting-memes', 'meeting-memes', true, 4194304, ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/webp'])
ON CONFLICT (id) DO NOTHING;
