-- The knowledge map: concepts extracted from each source, and the source<->concept
-- edges that make a space's captures converge on shared subjects.
--
-- Deliberately bipartite: sources connect *through* concepts rather than directly
-- to each other. A concept shared by 6 sources is 6 rows here, not the 15 a
-- source-to-source projection would need, which is what keeps the rendered map
-- readable as a space grows.

CREATE TABLE public.concepts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id   UUID NOT NULL REFERENCES public.spaces ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  -- Display form, e.g. "Load balancing".
  label      TEXT NOT NULL,
  -- Canonical key, e.g. "load-balancing". Derived with the same slugify() the
  -- space slugs use, so it satisfies the same character class.
  slug       TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),

  CONSTRAINT min_length_concept_label CHECK (char_length(trim(label)) >= 2),
  CONSTRAINT clean_concept_slug       CHECK (slug ~ '^[a-z0-9-]+$')
);

-- The canonicalization guarantee: one "load-balancing" per space, ever. The
-- extraction prompt is asked to reuse existing labels, but this index is what
-- actually makes a repeated concept merge instead of forking into a synonym.
CREATE UNIQUE INDEX concepts_space_slug_idx ON public.concepts (space_id, slug);

CREATE TABLE public.source_concepts (
  source_id  UUID NOT NULL REFERENCES public.sources  ON DELETE CASCADE,
  concept_id UUID NOT NULL REFERENCES public.concepts ON DELETE CASCADE,
  space_id   UUID NOT NULL REFERENCES public.spaces   ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users      ON DELETE CASCADE,
  -- LLM-reported salience 0..1; drives edge opacity on the map.
  weight     REAL NOT NULL DEFAULT 1 CHECK (weight > 0 AND weight <= 1),

  PRIMARY KEY (source_id, concept_id)
);

CREATE INDEX source_concepts_space_idx   ON public.source_concepts (space_id);
CREATE INDEX source_concepts_concept_idx ON public.source_concepts (concept_id);

-- Extraction bookkeeping, mirroring the summary_* columns from
-- 20260808154616_sources_summary_and_chats.sql. NULL means "not mapped yet",
-- which is what the backfill endpoint looks for.
ALTER TABLE public.sources
  ADD COLUMN concepts_model        TEXT,
  ADD COLUMN concepts_extracted_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.concepts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_concepts ENABLE ROW LEVEL SECURITY;

-- Same defense-in-depth pattern as sources/source_chunks: the backend uses the
-- service-role client and filters by user_id explicitly, so these policies only
-- cover direct anon-key access. Both tables are rewritten wholesale on
-- re-extraction (delete + insert), so neither needs an UPDATE policy.
CREATE POLICY "Allow individual concept insertion"
ON public.concepts FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow individual concept reading"
ON public.concepts FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Allow individual concept deletion"
ON public.concepts FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Allow individual source_concept insertion"
ON public.source_concepts FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow individual source_concept reading"
ON public.source_concepts FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Allow individual source_concept deletion"
ON public.source_concepts FOR DELETE
USING (auth.uid() = user_id);
