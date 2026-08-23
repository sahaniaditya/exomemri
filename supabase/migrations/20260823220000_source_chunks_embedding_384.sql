-- Switch source_chunks embeddings from Voyage 1024-d to Hugging Face
-- BAAI/bge-small-en-v1.5 (384-d). Old vectors are incompatible, so truncate
-- and let the pipeline re-embed on the next run. See
-- backend/app/services/embedding_service.py.

DROP INDEX IF EXISTS public.source_chunks_embedding_hnsw_idx;

TRUNCATE TABLE public.source_chunks;

ALTER TABLE public.source_chunks
  ALTER COLUMN embedding TYPE VECTOR(384);

CREATE INDEX source_chunks_embedding_hnsw_idx
  ON public.source_chunks
  USING hnsw (embedding vector_cosine_ops);

CREATE OR REPLACE FUNCTION public.match_source_chunks(
  target_source_id UUID,
  target_user_id UUID,
  query_embedding VECTOR(384),
  match_count INTEGER DEFAULT 6
) RETURNS TABLE (id UUID, content TEXT, chunk_index INTEGER, similarity FLOAT)
LANGUAGE sql STABLE AS $$
  SELECT id, content, chunk_index, 1 - (embedding <=> query_embedding) AS similarity
  FROM public.source_chunks
  WHERE source_id = target_source_id AND user_id = target_user_id
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;
