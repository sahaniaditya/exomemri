-- Capture-level sharing: a grant is one row on a source, not a space.
-- Existing space_collaborators rows (if any) are dropped, not migrated —
-- they meant "whole space," which is the wrong product.
--
-- The grant key is (source_id, user_id). space_id is copied from the source
-- at invite time so "Shared with you" can label the capture's space without
-- joining sources on every list; it is not the authorization key.

DROP TABLE IF EXISTS public.space_collaborators CASCADE;

CREATE TABLE public.source_collaborators (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id   UUID NOT NULL REFERENCES public.sources ON DELETE CASCADE,
  space_id    UUID NOT NULL REFERENCES public.spaces ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  invited_by  UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE UNIQUE INDEX source_collaborators_source_user_idx
  ON public.source_collaborators (source_id, user_id);
CREATE INDEX source_collaborators_user_idx ON public.source_collaborators (user_id);

ALTER TABLE public.source_collaborators ENABLE ROW LEVEL SECURITY;

-- Defense in depth: the backend uses the service role and filters explicitly.
-- These policies cover any direct anon-key access. A collaborator may read
-- their own grant rows; only the inviter (the owner, checked in the service)
-- inserts/deletes via the backend.
CREATE POLICY "Allow capture owner to insert collaborators"
ON public.source_collaborators FOR INSERT
WITH CHECK (auth.uid() = invited_by);

CREATE POLICY "Allow reading own collaborator grants"
ON public.source_collaborators FOR SELECT
USING (auth.uid() = user_id OR auth.uid() = invited_by);

CREATE POLICY "Allow capture owner to delete collaborators"
ON public.source_collaborators FOR DELETE
USING (auth.uid() = invited_by);
