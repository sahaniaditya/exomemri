-- The whole knowledge map for one space in a single round trip.
--
-- Same rationale as list_spaces_with_counts: the postgrest table API cannot
-- express the join + GROUP BY needed for concept degree, and the map needs
-- nodes, edges and extraction progress together or it renders in stages.
CREATE OR REPLACE FUNCTION public.get_space_graph(
  target_user  UUID,
  target_space UUID
)
RETURNS TABLE (
  concepts JSONB,
  sources  JSONB,
  edges    JSONB,
  pending  INT
)
LANGUAGE plpgsql
SECURITY DEFINER -- Bypasses RLS so the service-role backend can read on a user's behalf
SET search_path = public
AS $$
BEGIN
    -- SECURITY DEFINER means RLS is off inside this function, so the caller must
    -- not be able to read someone else's map. auth.uid() is NULL for the
    -- service-role backend (trusted, already verified the JWT and the space
    -- ownership itself) and set for a direct anon-key call, which may only ask
    -- for itself. Every CTE below additionally joins through `owned`, so an
    -- unowned space_id yields empty arrays rather than another user's data.
    IF auth.uid() IS NOT NULL AND auth.uid() <> target_user THEN
        RAISE EXCEPTION 'not authorized to read the knowledge map of another user';
    END IF;

    RETURN QUERY
    WITH owned AS (
        SELECT s.id
        FROM public.spaces s
        WHERE s.id = target_space
          AND s.user_id = target_user
    ),
    src AS (
        SELECT so.id, so.title, so.type, so.captured_at, so.concepts_extracted_at
        FROM public.sources so
        JOIN owned ON owned.id = so.space_id
    ),
    edge AS (
        SELECT sc.source_id, sc.concept_id, sc.weight
        FROM public.source_concepts sc
        JOIN owned ON owned.id = sc.space_id
    ),
    con AS (
        SELECT c.id, c.label, c.slug, COUNT(e.source_id)::INT AS degree
        FROM public.concepts c
        JOIN owned ON owned.id = c.space_id
        LEFT JOIN edge e ON e.concept_id = c.id
        GROUP BY c.id, c.label, c.slug
    )
    SELECT
        -- Ordered strongest-first so the client can render the space's spine
        -- (and truncate a long concept list) without re-sorting.
        COALESCE((
            SELECT JSONB_AGG(
                JSONB_BUILD_OBJECT('id', id, 'label', label, 'slug', slug, 'degree', degree)
                ORDER BY degree DESC, label
            ) FROM con
        ), '[]'::JSONB),
        COALESCE((
            SELECT JSONB_AGG(
                JSONB_BUILD_OBJECT(
                    'id', id, 'title', title, 'type', type, 'captured_at', captured_at
                )
                ORDER BY captured_at DESC
            ) FROM src
        ), '[]'::JSONB),
        COALESCE((
            SELECT JSONB_AGG(
                JSONB_BUILD_OBJECT(
                    'source_id', source_id, 'concept_id', concept_id, 'weight', weight
                )
            ) FROM edge
        ), '[]'::JSONB),
        -- Sources captured before this feature shipped, or whose extraction
        -- failed. Drives the backfill progress UI.
        (SELECT COUNT(*)::INT FROM src WHERE concepts_extracted_at IS NULL);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_space_graph(UUID, UUID) TO authenticated;


-- Re-extracting a source can strand a concept whose only referencing source
-- stopped mentioning it. Without this the map slowly fills with degree-0 nodes.
-- Expressed as an RPC because the postgrest table API cannot delete by an
-- anti-join / NOT EXISTS predicate.
CREATE OR REPLACE FUNCTION public.delete_orphan_concepts(target_space UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.concepts c
  WHERE c.space_id = target_space
    AND NOT EXISTS (
      SELECT 1 FROM public.source_concepts sc WHERE sc.concept_id = c.id
    );
$$;

-- Not granted to `authenticated`: this is a backend-only maintenance call made
-- with the service-role client, unlike get_space_graph which a browser could
-- legitimately issue for itself.
REVOKE ALL ON FUNCTION public.delete_orphan_concepts(UUID) FROM PUBLIC;
