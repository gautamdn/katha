-- 016_audio_storage_tiers.sql
-- Three audio fidelity tiers stored in three buckets with different access policies.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('audio-archival', 'audio-archival', false, 524288000, ARRAY['audio/wav', 'audio/flac', 'audio/x-wav']),
  ('audio-playback', 'audio-playback', false, 52428800, ARRAY['audio/ogg', 'audio/opus', 'audio/mpeg']),
  ('audio-share',    'audio-share',    false, 52428800, ARRAY['audio/ogg', 'audio/opus'])
ON CONFLICT (id) DO NOTHING;

-- Archival: service role only (no client access ever)
CREATE POLICY "archival service-role read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'audio-archival' AND auth.role() = 'service_role');

CREATE POLICY "archival service-role write"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'audio-archival' AND auth.role() = 'service_role');

-- Playback: family members of the call's elder can read
CREATE POLICY "playback family read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'audio-playback'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM elders WHERE family_id = get_my_family_id()
    )
  );

CREATE POLICY "playback service-role write"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'audio-playback' AND auth.role() = 'service_role');

-- Share: signed URL only, no direct read (signed URLs are issued by Edge Function for share-link viewer)
-- Plan 3 will wire share access control. For Plan 1, just service-role write.
CREATE POLICY "share service-role write"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'audio-share' AND auth.role() = 'service_role');
