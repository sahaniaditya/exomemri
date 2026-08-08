-- Summary is cached directly on the source (one summary per source, generated
-- once on first open). Chat turns get their own append-only table.

ALTER TABLE public.sources
  ADD COLUMN summary_text  TEXT,
  ADD COLUMN summary_model TEXT,
  ADD COLUMN summarized_at TIMESTAMP WITH TIME ZONE;

CREATE TABLE public.source_messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id  UUID NOT NULL REFERENCES public.sources ON DELETE CASCADE,
  space_id   UUID NOT NULL REFERENCES public.spaces ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content    TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE INDEX source_messages_source_created_idx
  ON public.source_messages (source_id, created_at);

ALTER TABLE public.source_messages ENABLE ROW LEVEL SECURITY;

-- Same defense-in-depth pattern as spaces/sources: backend uses service-role
-- and filters by user_id explicitly; these policies cover any direct anon-key
-- access. Messages are immutable, so no UPDATE policy.
CREATE POLICY "Allow individual message insertion"
ON public.source_messages FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow individual message reading"
ON public.source_messages FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Allow individual message deletion"
ON public.source_messages FOR DELETE
USING (auth.uid() = user_id);