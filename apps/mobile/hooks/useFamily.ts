import { useMutation, useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import { debug } from '@/lib/debug';
import * as api from '@/lib/api';
import { createFamilySchema, joinFamilySchema } from '@shared/schema';
import { queryKeys } from '@shared/queryKeys';

export function useFamily() {
  const user = useAuthStore((s) => s.user);
  const setProfile = useAuthStore((s) => s.setProfile);

  const createFamily = useMutation({
    mutationFn: async (params: { name: string }) => {
      debug.log('useFamily.createFamily', 'name:', params.name, 'userId:', user?.id);
      if (!user) throw new Error('Not authenticated');

      const validation = createFamilySchema.safeParse(params);
      if (!validation.success) {
        debug.error('useFamily.createFamily', 'validation failed:', validation.error.issues[0].message);
        throw new Error(validation.error.issues[0].message);
      }

      const family = await api.createFamily({
        name: params.name,
        userId: user.id,
      });
      debug.log('useFamily.createFamily', 'family created:', family.id, '— refreshing profile');

      // Refresh profile so it has the new family_id
      const updatedProfile = await api.getProfile(user.id);
      setProfile(updatedProfile);
      debug.log('useFamily.createFamily', 'profile refreshed, familyId:', updatedProfile?.family_id);

      return family;
    },
  });

  const joinFamily = useMutation({
    mutationFn: async (params: {
      inviteCode: string;
      relationshipLabel?: string;
    }) => {
      debug.log('useFamily.joinFamily', 'inviteCode:', params.inviteCode, 'userId:', user?.id);
      if (!user) throw new Error('Not authenticated');

      const validation = joinFamilySchema.safeParse({
        invite_code: params.inviteCode,
        relationship_label: params.relationshipLabel,
      });
      if (!validation.success) {
        debug.error('useFamily.joinFamily', 'validation failed:', validation.error.issues[0].message);
        throw new Error(validation.error.issues[0].message);
      }

      const family = await api.joinFamily({
        inviteCode: params.inviteCode,
        userId: user.id,
        relationshipLabel: params.relationshipLabel,
      });
      debug.log('useFamily.joinFamily', 'joined family:', family.id, '— refreshing profile');

      // Refresh profile so it has the new family_id
      const updatedProfile = await api.getProfile(user.id);
      setProfile(updatedProfile);
      debug.log('useFamily.joinFamily', 'profile refreshed, familyId:', updatedProfile?.family_id);

      return family;
    },
  });

  return { createFamily, joinFamily };
}

export function useFamilyInfo() {
  const profile = useAuthStore((s) => s.profile);
  const familyId = profile?.family_id;

  return useQuery({
    queryKey: queryKeys.families.detail(familyId ?? ''),
    queryFn: () => api.getFamily(familyId!),
    enabled: !!familyId,
  });
}
