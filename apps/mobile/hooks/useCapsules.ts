import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import { debug } from '@/lib/debug';
import * as api from '@/lib/api';
import { queryKeys } from '@shared/queryKeys';

const PAGE_SIZE = 20;

export function useFamilyFeed() {
  const profile = useAuthStore((s) => s.profile);
  const familyId = profile?.family_id;
  debug.log('useFamilyFeed', 'familyId:', familyId, 'enabled:', !!familyId);

  return useQuery({
    queryKey: queryKeys.capsules.family(familyId ?? ''),
    queryFn: () => {
      debug.log('useFamilyFeed', 'fetching family capsules...');
      return api.getFamilyCapsules(familyId!, { limit: PAGE_SIZE, offset: 0 });
    },
    enabled: !!familyId,
  });
}

export function useWriterCapsules(writerId?: string) {
  const user = useAuthStore((s) => s.user);
  const id = writerId ?? user?.id;

  return useQuery({
    queryKey: queryKeys.capsules.writer(id ?? ''),
    queryFn: () => api.getWriterCapsules(id!),
    enabled: !!id,
  });
}

export function useCapsuleDetail(capsuleId: string) {
  return useQuery({
    queryKey: queryKeys.capsules.detail(capsuleId),
    queryFn: () => api.getCapsule(capsuleId),
    enabled: !!capsuleId,
  });
}

export function usePublishCapsule() {
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      rawText: string;
      childId?: string | null;
      capsuleId?: string | null;
      audioUri?: string | null;
      audioDurationSeconds?: number | null;
      unlockType?: import('@shared/types').UnlockType;
      unlockDate?: string | null;
      unlockAge?: number | null;
      unlockMilestone?: import('@shared/types').MilestoneType | string | null;
      isSurprise?: boolean;
    }) => {
      debug.log('usePublishCapsule', '===== PUBLISH PIPELINE START =====');
      debug.log('usePublishCapsule', 'params:', JSON.stringify({
        rawTextLen: params.rawText.length,
        childId: params.childId,
        capsuleId: params.capsuleId,
        hasAudio: !!params.audioUri,
        audioDuration: params.audioDurationSeconds,
        unlockType: params.unlockType,
        isSurprise: params.isSurprise,
      }));

      if (!user || !profile?.family_id) {
        debug.error('usePublishCapsule', 'NOT AUTHENTICATED — user:', !!user, 'familyId:', profile?.family_id);
        throw new Error('Not authenticated');
      }

      const unlockType = params.unlockType ?? 'immediate';

      // Step 1: Create or update capsule row
      debug.log('usePublishCapsule', 'Step 1: Create/update capsule...');
      let capsuleId = params.capsuleId;
      if (!capsuleId) {
        const capsule = await api.createCapsule({
          writerId: user.id,
          familyId: profile.family_id,
          rawText: params.rawText,
          childId: params.childId,
          unlockType,
          unlockDate: params.unlockDate,
          unlockAge: params.unlockAge,
          unlockMilestone: params.unlockMilestone,
          isSurprise: params.isSurprise,
        });
        capsuleId = capsule.id;
        debug.log('usePublishCapsule', 'Step 1 done: created capsuleId:', capsuleId);
      } else {
        await api.updateCapsule(capsuleId, {
          raw_text: params.rawText,
          child_id: params.childId ?? undefined,
          unlock_type: unlockType,
          unlock_date: params.unlockDate ?? undefined,
          unlock_age: params.unlockAge ?? undefined,
          unlock_milestone: (params.unlockMilestone as import('@shared/types').MilestoneType) ?? undefined,
          is_surprise: params.isSurprise,
        });
        debug.log('usePublishCapsule', 'Step 1 done: updated existing capsuleId:', capsuleId);
      }

      // Step 2: If audio, upload to Storage and transcribe
      let textForPolish = params.rawText;
      if (params.audioUri) {
        debug.log('usePublishCapsule', 'Step 2: Upload audio...');
        const audioUrl = await api.uploadAudio(
          user.id,
          capsuleId,
          params.audioUri,
        );
        debug.log('usePublishCapsule', 'Step 2a: Audio uploaded, updating capsule...');

        await api.updateCapsule(capsuleId, {
          audio_url: audioUrl,
          audio_duration_seconds: params.audioDurationSeconds ?? undefined,
        });

        // Transcribe if no text provided
        if (!textForPolish) {
          debug.log('usePublishCapsule', 'Step 2b: No text — transcribing audio...');
          try {
            const { transcript } = await api.transcribeAudio({
              audioUrl,
              languagePreferences: profile.language_preferences,
            });
            textForPolish = transcript;
            await api.updateCapsule(capsuleId, { raw_text: transcript });
            debug.log('usePublishCapsule', 'Step 2b done: transcribed', transcript.length, 'chars');
          } catch (err) {
            debug.warn('usePublishCapsule', 'Step 2b: Transcription FAILED (continuing without text):', err);
          }
        }
      } else {
        debug.log('usePublishCapsule', 'Step 2: Skipped (no audio)');
      }

      // Step 3: AI Polish (skip if no text)
      let polishedText = textForPolish;
      if (textForPolish) {
        debug.log('usePublishCapsule', 'Step 3: AI Polish...');
        try {
          const polishResult = await api.polishText({
            text: textForPolish,
            languagePreferences: profile.language_preferences,
          });
          polishedText = polishResult.polished_text;
          debug.log('usePublishCapsule', 'Step 3 done: polished', polishedText.length, 'chars');
        } catch (err) {
          debug.warn('usePublishCapsule', 'Step 3: Polish FAILED (using raw text):', err);
        }
      } else {
        debug.log('usePublishCapsule', 'Step 3: Skipped (no text)');
      }

      // Step 4: AI Metadata (skip if no text)
      let metadata = {
        title: 'Untitled',
        excerpt: '',
        category: 'other',
        mood: 'reflective',
        readTimeMinutes: 1,
      };
      if (polishedText) {
        debug.log('usePublishCapsule', 'Step 4: AI Metadata...');
        try {
          const metadataResult = await api.generateMetadata({
            text: polishedText,
          });
          metadata = {
            title: metadataResult.title,
            excerpt: metadataResult.excerpt,
            category: metadataResult.category,
            mood: metadataResult.mood,
            readTimeMinutes: metadataResult.read_time_minutes,
          };
          debug.log('usePublishCapsule', 'Step 4 done: title:', metadata.title, 'category:', metadata.category);
        } catch (err) {
          debug.warn('usePublishCapsule', 'Step 4: Metadata FAILED (using defaults):', err);
        }
      } else {
        debug.log('usePublishCapsule', 'Step 4: Skipped (no text)');
      }

      // Step 5: Publish
      debug.log('usePublishCapsule', 'Step 5: Final publish...');
      const published = await api.publishCapsule(
        capsuleId,
        {
          polishedText: polishedText || '',
          title: metadata.title,
          excerpt: metadata.excerpt,
          category: metadata.category,
          mood: metadata.mood,
          readTimeMinutes: metadata.readTimeMinutes,
        },
        unlockType,
      );

      debug.log('usePublishCapsule', '===== PUBLISH PIPELINE COMPLETE =====');
      return published;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.capsules.all });
    },
  });
}
