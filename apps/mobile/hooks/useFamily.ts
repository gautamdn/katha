import { useMutation } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import * as api from '@/lib/api';
import { createFamilySchema, joinFamilySchema } from '@shared/schema';

export function useFamily() {
  const user = useAuthStore((s) => s.user);
  const setProfile = useAuthStore((s) => s.setProfile);

  const createFamily = useMutation({
    mutationFn: async (params: { name: string }) => {
      if (!user) throw new Error('Not authenticated');

      const validation = createFamilySchema.safeParse(params);
      if (!validation.success) {
        throw new Error(validation.error.issues[0].message);
      }

      const family = await api.createFamily({
        name: params.name,
        userId: user.id,
      });

      // Refresh profile so it has the new family_id
      const updatedProfile = await api.getProfile(user.id);
      setProfile(updatedProfile);

      return family;
    },
  });

  const joinFamily = useMutation({
    mutationFn: async (params: {
      inviteCode: string;
      relationshipLabel?: string;
    }) => {
      if (!user) throw new Error('Not authenticated');

      const validation = joinFamilySchema.safeParse({
        invite_code: params.inviteCode,
        relationship_label: params.relationshipLabel,
      });
      if (!validation.success) {
        throw new Error(validation.error.issues[0].message);
      }

      const family = await api.joinFamily({
        inviteCode: params.inviteCode,
        userId: user.id,
        relationshipLabel: params.relationshipLabel,
      });

      // Refresh profile so it has the new family_id
      const updatedProfile = await api.getProfile(user.id);
      setProfile(updatedProfile);

      return family;
    },
  });

  return { createFamily, joinFamily };
}
