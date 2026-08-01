-- Spaces + per-type source counts in one round trip.
--
-- The Supabase SDK cannot express a GROUP BY, and the dashboard's space tiles
-- need a count per source type, so this is exposed as an RPC in the same spirit
-- as check_username_exists.
CREATE OR REPLACE FUNCTION public.list_spaces_with_counts(target_user UUID)
RETURNS TABLE (
  id               UUID,
  name             TEXT,
  slug             TEXT,
  goal_text        TEXT,
  created_at       TIMESTAMP WITH TIME ZONE,
  last_captured_at TIMESTAMP WITH TIME ZONE,
  source_counts    JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER --  Bypasses RLS so the service-role backend can read on a user's behalf
SET search_path = public
AS $$
BEGIN
    -- SECURITY DEFINER means RLS is off inside this function, so the caller
    -- must not be able to read someone else's spaces. auth.uid() is NULL for
    -- the service-role backend (trusted, already verified the JWT itself) and
    -- set for a direct anon-key call, which may only ask for itself.
    IF auth.uid() IS NOT NULL AND auth.uid() <> target_user THEN
        RAISE EXCEPTION 'not authorized to list spaces for another user';
    END IF;

    RETURN QUERY
    SELECT
        s.id,
        s.name,
        s.slug,
        s.goal_text,
        s.created_at,
        MAX(src.captured_at) AS last_captured_at,
        JSONB_BUILD_OBJECT(
            'youtube', COUNT(src.id) FILTER (WHERE src.type = 'youtube'),
            'article', COUNT(src.id) FILTER (WHERE src.type = 'article'),
            'ai_chat', COUNT(src.id) FILTER (WHERE src.type = 'ai_chat'),
            'pdf',     COUNT(src.id) FILTER (WHERE src.type = 'pdf'),
            'note',    COUNT(src.id) FILTER (WHERE src.type = 'note'),
            'total',   COUNT(src.id)
        ) AS source_counts
    FROM public.spaces s
    LEFT JOIN public.sources src ON src.space_id = s.id
    WHERE s.user_id = target_user
      AND s.archived_at IS NULL
    GROUP BY s.id, s.name, s.slug, s.goal_text, s.created_at
    ORDER BY MAX(src.captured_at) DESC NULLS LAST, s.created_at DESC;
END;
$$;

-- Grant execution permissions explicitly to authenticated app users
GRANT EXECUTE ON FUNCTION public.list_spaces_with_counts(UUID) TO authenticated;
