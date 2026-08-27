-- Named note pages per capture (was a 1:1 notebook keyed by source_id).
-- Existing rows become a single page titled Untitled.

ALTER TABLE public.source_notes
  ADD COLUMN id UUID,
  ADD COLUMN title TEXT NOT NULL DEFAULT 'Untitled',
  ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW());

UPDATE public.source_notes
SET
  id = gen_random_uuid(),
  title = 'Untitled',
  sort_order = 0,
  created_at = updated_at
WHERE id IS NULL;

ALTER TABLE public.source_notes
  ALTER COLUMN id SET NOT NULL,
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

ALTER TABLE public.source_notes
  DROP CONSTRAINT source_notes_pkey;

ALTER TABLE public.source_notes
  ADD PRIMARY KEY (id);

ALTER TABLE public.source_notes
  ADD CONSTRAINT min_length_note_title CHECK (char_length(trim(title)) >= 1);

CREATE INDEX source_notes_source_sort_idx
  ON public.source_notes (source_id, sort_order);
