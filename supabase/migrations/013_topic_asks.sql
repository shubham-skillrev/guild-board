-- ============================================================
-- Migration 013: Ask a specific member into a topic
-- ============================================================
--
-- Why: the most reliable way to get a quiet person to speak in a small group
-- is being asked directly. An open comment box addressed to thirty people is
-- addressed to nobody; "@X you've done this — thoughts?" is answerable.
--
-- Guard rails matter more than the feature. Capped at 2 asks per topic per
-- asker so this cannot become a nag channel, and there is deliberately no
-- record of whether an ask was answered — a visible "asked and didn't reply"
-- would turn an invitation into an obligation.

CREATE TABLE public.topic_asks (
  topic_id    uuid        NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  asked_id    uuid        NOT NULL REFERENCES public.users(id)  ON DELETE CASCADE,
  asker_id    uuid        NOT NULL REFERENCES public.users(id)  ON DELETE CASCADE,
  note        text        CHECK (note IS NULL OR char_length(note) <= 140),
  created_at  timestamptz NOT NULL DEFAULT now(),

  -- One ask per person per topic; re-asking is a no-op, not a second buzz.
  PRIMARY KEY (topic_id, asked_id)
);

CREATE INDEX idx_topic_asks_topic ON public.topic_asks (topic_id);
CREATE INDEX idx_topic_asks_asked ON public.topic_asks (asked_id, created_at DESC);

ALTER TABLE public.topic_asks ENABLE ROW LEVEL SECURITY;

-- Asks are visible on the topic so the guild can see who has been invited
-- (and therefore not pile on the same person).
CREATE POLICY "topic_asks_select" ON public.topic_asks
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "topic_asks_insert_own" ON public.topic_asks
  FOR INSERT WITH CHECK (auth.uid() = asker_id);

-- Only the asker may withdraw. The asked person cannot delete the row —
-- but see the note above: nothing records whether they responded.
CREATE POLICY "topic_asks_delete_own" ON public.topic_asks
  FOR DELETE USING (auth.uid() = asker_id);

-- ─── Guard: max 2 asks per topic per asker ───────────────────
CREATE OR REPLACE FUNCTION public.check_ask_limit()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.asked_id = NEW.asker_id THEN
    RAISE EXCEPTION 'Cannot ask yourself';
  END IF;

  IF (
    SELECT COUNT(*) FROM public.topic_asks
    WHERE topic_id = NEW.topic_id AND asker_id = NEW.asker_id
  ) >= 2 THEN
    RAISE EXCEPTION 'Ask limit reached: max 2 people per topic';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_ask_limit
  BEFORE INSERT ON public.topic_asks
  FOR EACH ROW EXECUTE FUNCTION public.check_ask_limit();
