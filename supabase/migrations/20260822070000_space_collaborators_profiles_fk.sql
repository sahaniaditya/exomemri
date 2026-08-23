-- PostgREST can only embed profiles(...) when an FK exists from
-- space_collaborators.user_id to public.profiles. The original table only
-- referenced auth.users, which blocked the collaborators list join.
-- profiles.id already references auth.users, so this FK is compatible.

ALTER TABLE public.space_collaborators
  ADD CONSTRAINT space_collaborators_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
