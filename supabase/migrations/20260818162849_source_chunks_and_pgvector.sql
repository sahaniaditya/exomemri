-- RAG store: chunked + embedded source content for retrieval-based chat.
-- Voyage AI (voyage-4-lite, output_dimension pinned to 1024) generates the
-- vectors — see backend/app/services/embedding_service.py.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE public.source_chunks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id   UUID NOT NULL REFERENCES public.sources ON DELETE CASCADE,
  space_id    UUID NOT NULL REFERENCES public.spaces ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content     TEXT NOT NULL,
  token_count INTEGER NOT NULL,
  embedding   VECTOR(1024) NOT NULL,
  created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),

  CONSTRAINT source_chunks_source_index_uidx UNIQUE (source_id, chunk_index)
);

CREATE INDEX source_chunks_source_idx ON public.source_chunks (source_id);

-- HNSW over IVFFlat: no "train on N rows first" step, and this table grows
-- continuously as new sources are captured.
CREATE INDEX source_chunks_embedding_hnsw_idx
  ON public.source_chunks
  USING hnsw (embedding vector_cosine_ops);

ALTER TABLE public.source_chunks ENABLE ROW LEVEL SECURITY;

-- Same defense-in-depth pattern as source_messages: backend uses service-role
-- and filters by user_id explicitly. Chunks are immutable once written
-- (reprocessing deletes+reinserts via ChunkRepo.replace_chunks), so no
-- UPDATE policy.
CREATE POLICY "Allow individual chunk insertion"
ON public.source_chunks FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow individual chunk reading"
ON public.source_chunks FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Allow individual chunk deletion"
ON public.source_chunks FOR DELETE
USING (auth.uid() = user_id);

-- Cosine-similarity top-k for one source, scoped to its owner. Mirrors the
-- list_spaces_with_counts RPC pattern already used for list-with-aggregation
-- queries the postgrest table API can't express.
CREATE OR REPLACE FUNCTION public.match_source_chunks(
  target_source_id UUID,
  target_user_id UUID,
  query_embedding VECTOR(1024),
  match_count INTEGER DEFAULT 6
) RETURNS TABLE (id UUID, content TEXT, chunk_index INTEGER, similarity FLOAT)
LANGUAGE sql STABLE AS $$
  SELECT id, content, chunk_index, 1 - (embedding <=> query_embedding) AS similarity
  FROM public.source_chunks
  WHERE source_id = target_source_id AND user_id = target_user_id
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;
