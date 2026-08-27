-- Read-only space sharing: an owner grants a specific Atlas user (identified
-- by username, resolved server-side) view access to one space. Deliberately
-- account-based, not a public link — the recipient must be a real Atlas user,
-- so access is per-person and revocable, and captured content never sits
-- behind an unauthenticated route.
--
-- A collaborator's read access is scoped to the space's curated content
-- (sources, summaries, knowledge-map graph) only — review queue, study plan,
-- and streaks stay owner-only; nothing here grants access to those.

CREATE TABLE public.space_collaborators (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id    UUID NOT NULL REFERENCES public.spaces ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  invited_by  UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

-- One grant per (space, user) — inviting the same person twice is a no-op,
-- not a duplicate row.
CREATE UNIQUE INDEX space_collaborators_space_user_idx
  ON public.space_collaborators (space_id, user_id);
CREATE INDEX space_collaborators_user_idx ON public.space_collaborators (user_id);

ALTER TABLE public.space_collaborators ENABLE ROW LEVEL SECURITY;

-- Same defense-in-depth pattern as concepts/review_items: backend uses
-- service-role and filters explicitly; these policies cover any direct
-- anon-key access. A collaborator may read their own grant rows; only the
-- owner (checked in the service layer, not expressible here) inserts/deletes
-- via the backend — the anon-key INSERT/DELETE policies below cover the
-- owner's own direct access, mirroring the pattern elsewhere in this schema.
CREATE POLICY "Allow space owner to insert collaborators"
ON public.space_collaborators FOR INSERT
WITH CHECK (auth.uid() = invited_by);

CREATE POLICY "Allow reading own collaborator grants"
ON public.space_collaborators FOR SELECT
USING (auth.uid() = user_id OR auth.uid() = invited_by);

CREATE POLICY "Allow space owner to delete collaborators"
ON public.space_collaborators FOR DELETE
USING (auth.uid() = invited_by);
