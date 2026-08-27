-- Per-capture user notebook (annotations distinct from SourceType.note captures).
-- One row per source; TipTap JSON in content; images live under storage_prefix/notes/images/.

CREATE TABLE public.source_notes (
  source_id  UUID PRIMARY KEY REFERENCES public.sources(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  space_id   UUID NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  content    JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE INDEX source_notes_user_updated_idx
  ON public.source_notes (user_id, updated_at DESC);

ALTER TABLE public.source_notes ENABLE ROW LEVEL SECURITY;

-- Defense-in-depth: backend uses service-role and filters by user_id;
-- these policies cover any direct anon-key access.
CREATE POLICY "Allow individual note insertion"
ON public.source_notes FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow individual note reading"
ON public.source_notes FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Allow individual note update"
ON public.source_notes FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow individual note deletion"
ON public.source_notes FOR DELETE
USING (auth.uid() = user_id);
