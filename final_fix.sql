-- Definitive retrieval function - renaming to avoid caching issues
DROP FUNCTION IF EXISTS public.find_similar_chunks;

CREATE FUNCTION public.find_similar_chunks(
  query_embedding vector(1536),
  match_threshold double precision DEFAULT -0.5, -- Very permissive default
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
  WHERE (1 - (e.embedding <=> query_embedding)) > match_threshold
  ORDER BY e.embedding <=> query_embedding
  LIMIT match_count;
$$;
