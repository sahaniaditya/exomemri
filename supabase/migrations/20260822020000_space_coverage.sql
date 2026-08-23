-- Coverage % per space: an LLM-inferred syllabus (the topics someone learning
-- this subject would need to know, given the space's goal_text and captured
-- concepts) diffed against which of those topics the captured concepts
-- already satisfy. One row per space, not a column on `spaces` — `spaces` is
-- already at the column-split threshold in backend/CLAUDE.md, and this is a
-- distinct concern (like concepts/review_items got their own tables).
--
-- syllabus_concept_count is a cheap staleness fingerprint: when the space's
-- concept count changes, the cached syllabus no longer reflects what's been
-- captured, so the next read regenerates it.

CREATE TABLE public.space_coverage (
  space_id               UUID PRIMARY KEY REFERENCES public.spaces ON DELETE CASCADE,
  user_id                UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  coverage_pct           SMALLINT CHECK (coverage_pct BETWEEN 0 AND 100),
  syllabus_topics        JSONB NOT NULL DEFAULT '[]'::jsonb,
  syllabus_concept_count INTEGER NOT NULL DEFAULT 0,
  generated_at           TIMESTAMP WITH TIME ZONE,
  updated_at             TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

ALTER TABLE public.space_coverage ENABLE ROW LEVEL SECURITY;

-- Same defense-in-depth pattern as concepts/review_items: backend uses
-- service-role and filters by user_id explicitly; these policies cover any
-- direct anon-key access.
CREATE POLICY "Allow individual space coverage insertion"
ON public.space_coverage FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow individual space coverage reading"
ON public.space_coverage FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Allow individual space coverage update"
ON public.space_coverage FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Allow individual space coverage deletion"
ON public.space_coverage FOR DELETE
USING (auth.uid() = user_id);

-- Extend the dashboard tile RPC to carry the cached percentage along with the
-- existing per-type counts, so the space list stays one round trip. This
-- never triggers generation itself — a space with no cached row simply
-- reports NULL, and the on-demand coverage endpoint fills it in lazily.
DROP FUNCTION IF EXISTS public.list_spaces_with_counts(UUID);

CREATE FUNCTION public.list_spaces_with_counts(target_user UUID)
RETURNS TABLE (
  id               UUID,
  name             TEXT,
  slug             TEXT,
  goal_text        TEXT,
  created_at       TIMESTAMP WITH TIME ZONE,
  last_captured_at TIMESTAMP WITH TIME ZONE,
  source_counts    JSONB,
  coverage_pct     SMALLINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NOT NULL AND auth.uid() <> target_user THEN
        RAISE EXCEPTION 'not authorized to list spaces for another user';
    END IF;

    RETURN QUERY
    SELECT
        s.id,
        s.name,
        s.slug,
        s.goal_text,
        s.created_at,
        MAX(src.captured_at) AS last_captured_at,
        JSONB_BUILD_OBJECT(
            'youtube', COUNT(src.id) FILTER (WHERE src.type = 'youtube'),
            'article', COUNT(src.id) FILTER (WHERE src.type = 'article'),
            'ai_chat', COUNT(src.id) FILTER (WHERE src.type = 'ai_chat'),
            'pdf',     COUNT(src.id) FILTER (WHERE src.type = 'pdf'),
            'note',    COUNT(src.id) FILTER (WHERE src.type = 'note'),
            'total',   COUNT(src.id)
        ) AS source_counts,
        MAX(sc.coverage_pct) AS coverage_pct
    FROM public.spaces s
    LEFT JOIN public.sources src ON src.space_id = s.id
    LEFT JOIN public.space_coverage sc ON sc.space_id = s.id
    WHERE s.user_id = target_user
      AND s.archived_at IS NULL
    GROUP BY s.id, s.name, s.slug, s.goal_text, s.created_at
    ORDER BY MAX(src.captured_at) DESC NULLS LAST, s.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_spaces_with_counts(UUID) TO authenticated;
