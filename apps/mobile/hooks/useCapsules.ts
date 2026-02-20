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
    }) => {
      if (!user || !profile?.family_id) throw new Error('Not authenticated');

      // Step 1: Create or update capsule row
      let capsuleId = params.capsuleId;
      if (!capsuleId) {
        const capsule = await api.createCapsule({
          writerId: user.id,
          familyId: profile.family_id,
          rawText: params.rawText,
          childId: params.childId,
        });
        capsuleId = capsule.id;
      } else {
        await api.updateCapsule(capsuleId, {
          raw_text: params.rawText,
          child_id: params.childId ?? undefined,
        });
      }

      // Step 2: AI Polish
      const polishResult = await api.polishText({
        text: params.rawText,
        languagePreferences: profile.language_preferences,
      });

      // Step 3: AI Metadata
      const metadataResult = await api.generateMetadata({
        text: polishResult.polished_text,
      });

      // Step 4: Publish
      const published = await api.publishCapsule(capsuleId, {
        polishedText: polishResult.polished_text,
        title: metadataResult.title,
        excerpt: metadataResult.excerpt,
        category: metadataResult.category,
        mood: metadataResult.mood,
        readTimeMinutes: metadataResult.read_time_minutes,
      });

      return published;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.capsules.all });
    },
  });
}
