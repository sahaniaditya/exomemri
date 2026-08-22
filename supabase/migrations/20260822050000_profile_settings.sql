-- Public learning profiles: opt-in, private by default. A separate table
-- rather than another column on `profiles` — that table is already at 11
-- columns (past the 10-column split threshold in backend/CLAUDE.md) after
-- the streak fields, and more visibility knobs (per-space exclusion, etc.)
-- are plausible follow-ups, which would justify the split even before
-- hitting the threshold on `profiles` itself.
--
-- profile_public gates the ONE unauthenticated read route this app has:
-- GET /v1/profiles/{username}. False (the default) means 404, indistinguishable
-- from a username that doesn't exist at all — nothing is exposed until the
-- owner explicitly flips this.

CREATE TABLE public.profile_settings (
  user_id        UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  profile_public BOOLEAN NOT NULL DEFAULT false,
  updated_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

ALTER TABLE public.profile_settings ENABLE ROW LEVEL SECURITY;

-- Same defense-in-depth pattern as elsewhere: backend uses service-role and
-- filters explicitly; these policies cover any direct anon-key access. No
-- public SELECT policy here — the public read path goes through the
-- backend's service-role client only, never a direct anon-key query, so an
-- opted-out (or never-opted-in) profile is never queryable from the browser.
CREATE POLICY "Allow individual profile settings insertion"
ON public.profile_settings FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow individual profile settings reading"
ON public.profile_settings FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Allow individual profile settings update"
ON public.profile_settings FOR UPDATE
USING (auth.uid() = user_id);
