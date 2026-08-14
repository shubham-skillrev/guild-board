-- 017  Release banked ideas whose topic was deleted
--
-- idea_bank.promoted_topic_id is declared ON DELETE SET NULL, but topics are
-- soft-deleted (is_deleted = true) and the row is never removed, so the
-- constraint never fires.
--
-- That produced a dead end. The bank refused to delete a promoted idea with
-- "Already on the board - delete the topic instead"; deleting the topic left
-- promoted_topic_id set; so the idea could then be neither re-pitched nor
-- deleted. Permanently stuck, with no path out from the UI.
--
-- The API now clears these three columns when a topic is soft-deleted. This
-- heals the rows already in that state.

UPDATE public.idea_bank AS ib
SET promoted_topic_id = NULL,
    promoted_by       = NULL,
    promoted_at       = NULL
FROM public.topics AS t
WHERE ib.promoted_topic_id = t.id
  AND t.is_deleted = true;

-- Verification
--   Expect 0 rows: banked ideas still pointing at a deleted topic.
--   SELECT ib.id, ib.title
--   FROM public.idea_bank ib
--   JOIN public.topics t ON t.id = ib.promoted_topic_id
--   WHERE t.is_deleted = true;
