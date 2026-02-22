import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import * as api from '@/lib/api';
import { queryKeys } from '@shared/queryKeys';

const PAGE_SIZE = 20;

export function useFamilyFeed() {
  const profile = useAuthStore((s) => s.profile);
  const familyId = profile?.family_id;

  return useQuery({
    queryKey: queryKeys.capsules.family(familyId ?? ''),
    queryFn: () =>
      api.getFamilyCapsules(familyId!, { limit: PAGE_SIZE, offset: 0 }),
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
      if (!user || !profile?.family_id) throw new Error('Not authenticated');

      const unlockType = params.unlockType ?? 'immediate';

      // Step 1: Create or update capsule row
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
      }

      // Step 2: If audio, upload to Storage and transcribe
      let textForPolish = params.rawText;
      if (params.audioUri) {
        const audioUrl = await api.uploadAudio(
          user.id,
          capsuleId,
          params.audioUri,
        );

        await api.updateCapsule(capsuleId, {
          audio_url: audioUrl,
          audio_duration_seconds: params.audioDurationSeconds ?? undefined,
        });

        // Transcribe if no text provided
        if (!textForPolish) {
          try {
            const { transcript } = await api.transcribeAudio({
              audioUrl,
              languagePreferences: profile.language_preferences,
            });
            textForPolish = transcript;
            await api.updateCapsule(capsuleId, { raw_text: transcript });
          } catch (err) {
            console.warn('[usePublishCapsule] Transcription failed:', err);
          }
        }
      }

      // Step 3: AI Polish (skip if no text)
      let polishedText = textForPolish;
      if (textForPolish) {
        try {
          const polishResult = await api.polishText({
            text: textForPolish,
            languagePreferences: profile.language_preferences,
          });
          polishedText = polishResult.polished_text;
        } catch (err) {
          console.warn('[usePublishCapsule] Polish failed:', err);
        }
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
        } catch (err) {
          console.warn('[usePublishCapsule] Metadata failed:', err);
        }
      }

      // Step 5: Publish
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

      return published;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.capsules.all });
    },
  });
}
