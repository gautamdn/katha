import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import * as api from '@/lib/api';
import { queryKeys } from '@shared/queryKeys';

export function useProfileUpdate() {
  const user = useAuthStore((s) => s.user);
  const setProfile = useAuthStore((s) => s.setProfile);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: {
      display_name?: string;
      bio?: string;
      relationship_label?: string;
    }) => {
      if (!user) throw new Error('Not authenticated');
      return api.updateProfile(user.id, updates);
    },
    onSuccess: (updatedProfile) => {
      setProfile(updatedProfile);
      if (user) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.profiles.detail(user.id),
        });
      }
    },
  });
}

export function useFamilyMembers() {
  const profile = useAuthStore((s) => s.profile);
  const familyId = profile?.family_id;

  return useQuery({
    queryKey: queryKeys.profiles.familyMembers(familyId ?? ''),
    queryFn: () => api.getFamilyMembers(familyId!),
    enabled: !!familyId,
  });
}

export function useWriterProfile(writerId: string) {
  return useQuery({
    queryKey: queryKeys.profiles.detail(writerId),
    queryFn: () => api.getProfile(writerId),
    enabled: !!writerId,
  });
}
