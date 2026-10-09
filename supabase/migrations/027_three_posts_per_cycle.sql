-- 027  Three posts per person per cycle
--
-- One post each kept the board fair but left people choosing between things
-- they wanted to bring. The cap is now three. GuildBot is still exempt, and
-- carried-forward posts still do not count. Otherwise identical to 025.
--
-- To put the old cap back, run this file with 3 replaced by 1 in both places.

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
  ) >= 3 THEN
    RAISE EXCEPTION 'Topic limit reached: max 3 topics per cycle';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
