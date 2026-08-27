-- Product reviews left by signed-in users (one per user). The landing page
-- surfaces the top 5 by rating; the profile page upserts the caller's row.

CREATE TABLE public.product_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 10 AND 1000),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

-- PostgREST can only embed profiles(...) when an FK exists to public.profiles.
-- profiles.id already references auth.users, so this second FK is compatible.
ALTER TABLE public.product_reviews
  ADD CONSTRAINT product_reviews_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

CREATE INDEX product_reviews_rating_updated_idx
  ON public.product_reviews (rating DESC, updated_at DESC);

ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;

-- Defense-in-depth: backend uses service-role and filters by user_id;
-- these policies cover any direct anon-key access. Public top-5 reads go
-- through the service-role backend, not anon RLS.
CREATE POLICY "Allow individual review insertion"
ON public.product_reviews FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow individual review reading"
ON public.product_reviews FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Allow individual review update"
ON public.product_reviews FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow individual review deletion"
ON public.product_reviews FOR DELETE
USING (auth.uid() = user_id);
