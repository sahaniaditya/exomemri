-- Shareable capture links: one active opaque token per source.
-- Redeeming creates a source_collaborators row (same read-only grant as
-- username invite). Revoking the link blocks new redeems only — existing
-- collaborators keep access until removed individually.
--
-- source_id is not globally unique: revoked rows stay for audit; only one
-- active (revoked_at IS NULL) link may exist per source.

CREATE TABLE public.source_share_links (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id   UUID NOT NULL REFERENCES public.sources ON DELETE CASCADE,
  space_id    UUID NOT NULL REFERENCES public.spaces ON DELETE CASCADE,
  token       TEXT NOT NULL,
  created_by  UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  revoked_at  TIMESTAMP WITH TIME ZONE
);

CREATE UNIQUE INDEX source_share_links_token_idx
  ON public.source_share_links (token);

CREATE UNIQUE INDEX source_share_links_active_source_idx
  ON public.source_share_links (source_id)
  WHERE revoked_at IS NULL;

CREATE INDEX source_share_links_source_idx
  ON public.source_share_links (source_id);

ALTER TABLE public.source_share_links ENABLE ROW LEVEL SECURITY;

-- Defense in depth: backend uses the service role and filters explicitly.
CREATE POLICY "Allow capture owner to insert share links"
ON public.source_share_links FOR INSERT
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Allow capture owner to read share links"
ON public.source_share_links FOR SELECT
USING (auth.uid() = created_by);

CREATE POLICY "Allow capture owner to update share links"
ON public.source_share_links FOR UPDATE
USING (auth.uid() = created_by);
