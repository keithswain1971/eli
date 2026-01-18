-- Debug function: Returns top chunks by distance, IGNORING threshold
-- This proves if the distance calculation is working at all.

DROP FUNCTION IF EXISTS public.find_chunks_debug;

CREATE FUNCTION public.find_chunks_debug(
  query_embedding vector(1536),
  match_threshold double precision DEFAULT -100.0, -- Unused but kept for signature compatibility
  match_count integer DEFAULT 5
)
RETURNS TABLE (
  chunk_id uuid,
  content text,
  document_id uuid,
  title text,
  url text,
  source_type text,
  similarity double precision
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id as chunk_id,
    c.content,
    d.id as document_id,
    d.title,
    d.url,
    d.source_type,
    (1 - (e.embedding <=> query_embedding))::double precision as similarity
  FROM eli_embeddings e
  JOIN eli_chunks c ON c.id = e.chunk_id
  JOIN eli_documents d ON d.id = c.document_id
  -- NO WHERE CLAUSE. We want to see EVERYTHING (top 5 worst or best)
  ORDER BY e.embedding <=> query_embedding ASC
  LIMIT match_count;
$$;
