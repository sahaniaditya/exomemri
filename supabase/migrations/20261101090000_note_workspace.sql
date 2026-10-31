-- Notes workspace: page tree (one level), icon/cover, soft-delete trash, searchable text,
-- and capture/page links. Additive and idempotent: every existing space_notes row stays valid.

ALTER TABLE public.space_notes
  ADD COLUMN IF NOT EXISTS parent_id    UUID REFERENCES public.space_notes(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS icon         TEXT,
  ADD COLUMN IF NOT EXISTS cover_key    TEXT,
  ADD COLUMN IF NOT EXISTS full_width   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS content_text TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS deleted_at   TIMESTAMP WITH TIME ZONE;

DO $$
BEGIN
  ALTER TABLE public.space_notes
    ADD CONSTRAINT space_notes_not_own_parent CHECK (parent_id IS NULL OR parent_id <> id);
EXCEPTION WHEN duplicate_object THEN
  NULL;
END
$$;

CREATE INDEX IF NOT EXISTS space_notes_tree_idx
  ON public.space_notes (space_id, parent_id, sort_order);

CREATE INDEX IF NOT EXISTS space_notes_trashed_idx
  ON public.space_notes (space_id, deleted_at)
  WHERE deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS space_notes_fts_idx
  ON public.space_notes
  USING GIN (to_tsvector('simple', coalesce(title, '') || ' ' || content_text));

-- Outgoing links from a note to a capture ("source") or another note. Targets are
-- polymorphic, so there is no FK on target_id; readers drop targets that no longer resolve.
CREATE TABLE IF NOT EXISTS public.note_links (
  note_id     UUID NOT NULL REFERENCES public.space_notes(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('source', 'note')),
  target_id   UUID NOT NULL,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  PRIMARY KEY (note_id, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS note_links_target_idx
  ON public.note_links (target_type, target_id);

ALTER TABLE public.note_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow individual note link insertion" ON public.note_links;
CREATE POLICY "Allow individual note link insertion"
ON public.note_links FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow individual note link reading" ON public.note_links;
CREATE POLICY "Allow individual note link reading"
ON public.note_links FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow individual note link update" ON public.note_links;
CREATE POLICY "Allow individual note link update"
ON public.note_links FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow individual note link deletion" ON public.note_links;
CREATE POLICY "Allow individual note link deletion"
ON public.note_links FOR DELETE
USING (auth.uid() = user_id);

-- Ranked full-text search over live pages. The @@ predicate repeats the GIN index
-- expression exactly so the planner can use space_notes_fts_idx. Called by the backend
-- (service role), so ownership is enforced by the explicit p_user_id filter.
CREATE OR REPLACE FUNCTION public.search_space_notes(
  p_space_id UUID,
  p_user_id  UUID,
  p_query    TEXT,
  p_limit    INTEGER DEFAULT 20
)
RETURNS TABLE (
  id           UUID,
  title        TEXT,
  icon         TEXT,
  content_text TEXT,
  rank         REAL
)
LANGUAGE sql
STABLE
AS $$
  SELECT n.id,
         n.title,
         n.icon,
         n.content_text,
         ts_rank(
           setweight(to_tsvector('simple', coalesce(n.title, '')), 'A')
             || setweight(to_tsvector('simple', n.content_text), 'B'),
           plainto_tsquery('simple', p_query)
         ) AS rank
  FROM public.space_notes n
  WHERE n.space_id = p_space_id
    AND n.user_id = p_user_id
    AND n.deleted_at IS NULL
    AND to_tsvector('simple', coalesce(n.title, '') || ' ' || n.content_text)
        @@ plainto_tsquery('simple', p_query)
  ORDER BY rank DESC, n.updated_at DESC
  LIMIT greatest(1, least(p_limit, 50));
$$;
