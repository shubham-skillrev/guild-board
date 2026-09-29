-- 025  Topics posted by GuildBoard itself
--
-- Each month GuildBoard suggests a few things worth discussing that nobody has
-- brought yet: notable tech and AI releases that are not already on the board
-- or in Bytes. They sit on the board like any other post, and the guild votes
-- on them the same way. People decide; the system only suggests.
--
-- The posts need an author, and topics.user_id references users(id), which in
-- turn references auth.users(id). So the system is a real account, created by
-- the app through the Supabase Admin API (it has no password and cannot sign
-- in), marked here with `is_system`. The topic carries its own `is_system` too,
-- so reads, rankings and the landing page can filter without joining users.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false;

ALTER TABLE public.topics
  ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false;

-- One post per person per cycle still holds for people. The system can post
-- several. Otherwise identical to the definition in 006.
CREATE OR REPLACE FUNCTION check_topic_limit()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_system THEN
    RETURN NEW;
  END IF;
  IF (
    SELECT COUNT(*) FROM public.topics
    WHERE user_id = NEW.user_id
      AND cycle_id = NEW.cycle_id
      AND is_deleted = FALSE
      AND is_carry_forward = FALSE
  ) >= 1 THEN
    RAISE EXCEPTION 'Topic limit reached: max 1 topic per cycle';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
