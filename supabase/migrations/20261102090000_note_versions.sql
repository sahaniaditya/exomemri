-- Version history for space notes. Snapshots of title + content, owner-only.
-- Additive and idempotent: safe to apply more than once.

CREATE TABLE IF NOT EXISTS public.note_versions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id    UUID NOT NULL REFERENCES public.space_notes(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  content    JSONB NOT NULL,
  reason     TEXT NOT NULL DEFAULT 'idle'
             CHECK (reason IN ('idle', 'manual', 'pre_restore')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE INDEX IF NOT EXISTS note_versions_note_created_idx
  ON public.note_versions (note_id, created_at DESC);

ALTER TABLE public.note_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow individual note version insertion" ON public.note_versions;
CREATE POLICY "Allow individual note version insertion"
ON public.note_versions FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow individual note version reading" ON public.note_versions;
CREATE POLICY "Allow individual note version reading"
ON public.note_versions FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow individual note version update" ON public.note_versions;
CREATE POLICY "Allow individual note version update"
ON public.note_versions FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow individual note version deletion" ON public.note_versions;
CREATE POLICY "Allow individual note version deletion"
ON public.note_versions FOR DELETE
USING (auth.uid() = user_id);
