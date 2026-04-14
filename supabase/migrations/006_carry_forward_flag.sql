-- Migration 006: Add is_carry_forward flag to topics
-- Carry-forward copies should not count toward the 1-topic-per-cycle limit.

ALTER TABLE public.topics
  ADD COLUMN IF NOT EXISTS is_carry_forward BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill: mark existing carry-forward copies based on override_reason
UPDATE public.topics
  SET is_carry_forward = TRUE
  WHERE override_reason LIKE 'Carried forward from%'
    AND is_carry_forward = FALSE;

-- Update trigger to ignore carry-forward copies when enforcing the topic limit
CREATE OR REPLACE FUNCTION check_topic_limit()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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
