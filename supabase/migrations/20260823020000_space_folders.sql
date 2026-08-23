-- One-level folders inside a Learning Space. Captures (sources) can optionally
-- sit in a folder so the owner can group them (e.g. "Claude Code usage" vs
-- "Claude Code articles"). New captures still land ungrouped (folder_id NULL).
-- Deleting a folder ungroups its captures — it never deletes them.

CREATE TABLE public.space_folders (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id    UUID NOT NULL REFERENCES public.spaces ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name        TEXT NOT NULL,
  created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),

  CONSTRAINT min_length_folder_name CHECK (char_length(trim(name)) >= 2)
);

-- One "Claude Code articles" per space, case-insensitive.
CREATE UNIQUE INDEX space_folders_space_name_idx
  ON public.space_folders (space_id, lower(name));
CREATE INDEX space_folders_space_created_idx
  ON public.space_folders (space_id, created_at);

ALTER TABLE public.sources
  ADD COLUMN folder_id UUID REFERENCES public.space_folders ON DELETE SET NULL;

CREATE INDEX sources_folder_idx ON public.sources (folder_id)
  WHERE folder_id IS NOT NULL;

ALTER TABLE public.space_folders ENABLE ROW LEVEL SECURITY;

-- Defense-in-depth: the backend uses the service-role client and filters by
-- user_id / space ownership in SpaceRepo. These policies cover any future
-- query issued with the anon key.
CREATE POLICY "Allow individual folder insertion"
ON public.space_folders FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow individual folder reading"
ON public.space_folders FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Allow individual folder updating"
ON public.space_folders FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow individual folder deletion"
ON public.space_folders FOR DELETE
USING (auth.uid() = user_id);
