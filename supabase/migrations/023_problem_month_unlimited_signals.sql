-- 023  Problem Month: uncap "I've hit this too" and "I've dealt with this"
--
-- For one cycle the board collects problems instead of topics. A vote now means
-- "I've hit this too" and a hand raise means "I've dealt with this". Both are
-- only useful as a measure of what resonates if people can mark every problem
-- they relate to, so the per-cycle caps (3 votes, 2 contributions) come off.
--
-- Only the triggers are dropped. check_vote_limit() and check_contrib_limit()
-- stay, as last defined in 002, so restoring the caps is:
--
--   CREATE TRIGGER enforce_vote_limit
--   BEFORE INSERT ON public.votes
--   FOR EACH ROW EXECUTE FUNCTION check_vote_limit();
--
--   CREATE TRIGGER enforce_contrib_limit
--   BEFORE INSERT ON public.contributions
--   FOR EACH ROW EXECUTE FUNCTION check_contrib_limit();
--
-- The one-topic-per-user trigger is untouched: "bring one problem" is the brief.

DROP TRIGGER IF EXISTS enforce_vote_limit ON public.votes;
DROP TRIGGER IF EXISTS enforce_contrib_limit ON public.contributions;
