-- Create storage bucket for capsule audio files.
-- Path convention: capsule-audio/{userId}/{capsuleId}.m4a

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'capsule-audio',
  'capsule-audio',
  true,
  52428800, -- 50 MB
  ARRAY['audio/mp4', 'audio/m4a', 'audio/x-m4a', 'audio/mpeg', 'audio/wav']
);

-- Authenticated users can upload audio
CREATE POLICY "Authenticated users can upload audio"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'capsule-audio'
  AND auth.role() = 'authenticated'
);

-- Public read for playback
CREATE POLICY "Anyone can read audio"
ON storage.objects FOR SELECT
USING (bucket_id = 'capsule-audio');

-- Users can delete their own uploads (first path segment = userId)
CREATE POLICY "Users can delete own audio"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'capsule-audio'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
