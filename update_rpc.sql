-- Run this in Supabase SQL Editor to update the match_chunks function
-- This creates the correct version that accepts a vector array (matching the new code)

DROP FUNCTION IF EXISTS public.match_chunks;

CREATE OR REPLACE FUNCTION public.match_chunks(
  query_embedding vector(1536),
  match_threshold double precision DEFAULT 0.5,
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
LANGUAGE sql STABLE
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
