-- Space-level named note pages (TipTap JSON), parallel to source_notes.
-- Images live under users/{user_id}/spaces/{space_id}/notes/images/.

CREATE TABLE public.space_notes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id   UUID NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL DEFAULT 'Untitled',
  content    JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  CONSTRAINT min_length_space_note_title CHECK (char_length(trim(title)) >= 1)
);

CREATE INDEX space_notes_space_sort_idx
  ON public.space_notes (space_id, sort_order);

CREATE INDEX space_notes_user_updated_idx
  ON public.space_notes (user_id, updated_at DESC);

ALTER TABLE public.space_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow individual space note insertion"
ON public.space_notes FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow individual space note reading"
ON public.space_notes FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Allow individual space note update"
ON public.space_notes FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow individual space note deletion"
ON public.space_notes FOR DELETE
USING (auth.uid() = user_id);
