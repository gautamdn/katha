CREATE OR REPLACE FUNCTION search_persona_index(
  elder_id_arg UUID,
  query_embedding vector(1536),
  match_count INT DEFAULT 6
)
RETURNS TABLE (
  fact_text TEXT,
  fact_type persona_fact_type,
  audio_clip_url TEXT,
  similarity FLOAT,
  call_started_at TIMESTAMPTZ
)
LANGUAGE sql STABLE
SET search_path = public, extensions
AS $$
  SELECT
    pi.text AS fact_text,
    pi.fact_type,
    pi.audio_clip_url,
    1 - (pi.embedding <=> query_embedding) AS similarity,
    c.started_at AS call_started_at
  FROM persona_index pi
  LEFT JOIN calls c ON c.id = pi.source_call_id
  WHERE pi.elder_id = elder_id_arg
    AND pi.voice_verified = true
  ORDER BY pi.embedding <=> query_embedding
  LIMIT match_count;
$$;
