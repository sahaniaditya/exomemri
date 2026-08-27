-- Daily review queue: one durable row per interview point extracted from a
-- source's structured summary. Materialized (not read live off
-- summary_sections) so review state attaches to a stable id and survives
-- re-summarization.
--
-- V2 scope deliberately has no spaced-repetition fields (ease/interval) — the
-- only signal is a binary "mark reviewed" action, so the queue is just a
-- staleness filter on last_reviewed_at. A real SRS algorithm can add columns
-- here later without a breaking rewrite.

CREATE TABLE public.review_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id        UUID NOT NULL REFERENCES public.sources ON DELETE CASCADE,
  space_id         UUID NOT NULL REFERENCES public.spaces  ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES auth.users      ON DELETE CASCADE,
  prompt_text      TEXT NOT NULL,
  last_reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),

  CONSTRAINT min_length_review_prompt CHECK (char_length(trim(prompt_text)) >= 2)
);

CREATE INDEX review_items_space_due_idx ON public.review_items (space_id, last_reviewed_at);

-- Regenerating items on re-summarization must not duplicate rows for the same
-- interview point.
CREATE UNIQUE INDEX review_items_source_prompt_idx ON public.review_items (source_id, prompt_text);

-- Bookkeeping, mirroring concepts_extracted_at from
-- 20260818233000_concepts_and_graph.sql. NULL means "not generated yet", which
-- is what the backfill endpoint looks for.
ALTER TABLE public.sources
  ADD COLUMN review_items_extracted_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.review_items ENABLE ROW LEVEL SECURITY;

-- Same defense-in-depth pattern as concepts/source_concepts: backend uses
-- service-role and filters by user_id explicitly; these policies cover any
-- direct anon-key access. Rewritten wholesale on re-generation (delete +
-- insert) except for last_reviewed_at, which needs its own UPDATE policy.
CREATE POLICY "Allow individual review item insertion"
ON public.review_items FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow individual review item reading"
ON public.review_items FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Allow individual review item update"
ON public.review_items FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Allow individual review item deletion"
ON public.review_items FOR DELETE
USING (auth.uid() = user_id);
