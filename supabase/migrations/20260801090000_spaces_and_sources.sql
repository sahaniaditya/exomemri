-- Learning Spaces and the sources captured into them.
--
-- Until now a capture wrote only flat files to the private `atlas-artifacts`
-- bucket under users/{user_id}/spaces/{space_id}/sources/{source_id}/, with all
-- metadata buried in a raw/meta.json sidecar. Nothing was queryable and the
-- active space lived in an in-process dict. These two tables make both durable.

CREATE TABLE public.spaces (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL,
  goal_text   TEXT,
  archived_at TIMESTAMP WITH TIME ZONE,
  created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),

  -- Data Integrity Constraints
  CONSTRAINT min_length_space_name CHECK (char_length(trim(name)) >= 2),
  CONSTRAINT clean_space_slug      CHECK (slug ~ '^[a-z0-9-]+$')
);

-- One "Claude Code" per user, case-insensitive. The slug is the stable url key.
CREATE UNIQUE INDEX spaces_user_name_idx ON public.spaces (user_id, lower(name));
CREATE UNIQUE INDEX spaces_user_slug_idx ON public.spaces (user_id, slug);
CREATE INDEX spaces_user_created_idx ON public.spaces (user_id, created_at DESC);

CREATE TABLE public.sources (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id UUID NOT NULL REFERENCES public.spaces ON DELETE CASCADE,
  user_id  UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  -- Must stay in sync with SourceType in backend/app/schemas/common.py.
  type     TEXT NOT NULL CHECK (type IN ('youtube', 'article', 'ai_chat', 'pdf', 'note')),
  title    TEXT NOT NULL,
  url      TEXT,
  author   TEXT,
  -- Bucket prefix owning this source's artifacts; the individual keys hang off
  -- it (raw/meta.json, raw/transcript.json, raw/page.html, original.pdf, ...).
  storage_prefix    TEXT NOT NULL,
  content_hash      TEXT NOT NULL,
  processing_status TEXT NOT NULL DEFAULT 'queued',
  captured_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE INDEX sources_space_captured_idx ON public.sources (space_id, captured_at DESC);
CREATE INDEX sources_user_captured_idx  ON public.sources (user_id, captured_at DESC);
-- Idempotency: re-capturing the same page into the same space updates the row
-- rather than duplicating it (content_hash is the capture idempotency key).
CREATE UNIQUE INDEX sources_space_hash_idx ON public.sources (space_id, content_hash);

-- The active space, persisted. Replaces SessionService's in-memory dict, which
-- reset on every backend restart.
ALTER TABLE public.profiles
  ADD COLUMN active_space_id UUID REFERENCES public.spaces ON DELETE SET NULL;

-- Enable Row Level Security (RLS)
ALTER TABLE public.spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sources ENABLE ROW LEVEL SECURITY;

-- RLS Policies. The backend reaches these tables with the service-role client
-- and therefore bypasses RLS; the authoritative isolation is the explicit
-- user_id filter in SpaceRepo. These policies are defense-in-depth for any
-- future query issued straight from the browser with the anon key.
CREATE POLICY "Allow individual space insertion"
ON public.spaces FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow individual space reading"
ON public.spaces FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Allow individual space updating"
ON public.spaces FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow individual space deletion"
ON public.spaces FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Allow individual source insertion"
ON public.sources FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow individual source reading"
ON public.sources FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Allow individual source updating"
ON public.sources FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow individual source deletion"
ON public.sources FOR DELETE
USING (auth.uid() = user_id);
