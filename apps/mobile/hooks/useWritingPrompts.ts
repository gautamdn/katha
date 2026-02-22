import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import { useChildren } from './useChildren';
import * as api from '@/lib/api';
import { queryKeys } from '@shared/queryKeys';
import type { AIPrompt } from '@shared/types';

export function useWritingPrompts() {
  const profile = useAuthStore((s) => s.profile);
  const { children: childrenQuery } = useChildren();

  const writerId = profile?.id;
  const children = childrenQuery.data;

  return useQuery({
    queryKey: queryKeys.prompts.writer(writerId ?? ''),
    queryFn: async (): Promise<AIPrompt[]> => {
      if (!writerId) return [];

      // Calculate children's ages
      const childrenAges = (children ?? []).map((child) => {
        const dob = new Date(child.date_of_birth);
        const now = new Date();
        return Math.floor(
          (now.getTime() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000),
        );
      });

      const result = await api.getWritingPrompts({
        writerId,
        languagePreferences: profile?.language_preferences,
        childrenAges: childrenAges.length > 0 ? childrenAges : undefined,
      });

      return result.prompts;
    },
    enabled: !!writerId,
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
  });
}
