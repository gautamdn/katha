import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import { debug } from '@/lib/debug';
import * as api from '@/lib/api';
import { createChildSchema } from '@shared/schema';
import { queryKeys } from '@shared/queryKeys';

export function useChildren() {
  const profile = useAuthStore((s) => s.profile);
  const familyId = profile?.family_id;
  const queryClient = useQueryClient();

  const children = useQuery({
    queryKey: queryKeys.children.family(familyId ?? ''),
    queryFn: () => {
      debug.log('useChildren', 'fetching children for familyId:', familyId);
      return api.getChildren(familyId!);
    },
    enabled: !!familyId,
  });

  const createChild = useMutation({
    mutationFn: async (params: { name: string; dateOfBirth: string }) => {
      debug.log('useChildren.createChild', 'name:', params.name, 'familyId:', familyId);
      if (!familyId) throw new Error('No family');

      const validation = createChildSchema.safeParse({
        name: params.name,
        date_of_birth: params.dateOfBirth,
      });
      if (!validation.success) {
        debug.error('useChildren.createChild', 'validation failed:', validation.error.issues[0].message);
        throw new Error(validation.error.issues[0].message);
      }

      return api.createChild({
        familyId,
        name: params.name,
        dateOfBirth: params.dateOfBirth,
      });
    },
    onSuccess: () => {
      debug.log('useChildren.createChild', 'success — invalidating cache');
      queryClient.invalidateQueries({
        queryKey: queryKeys.children.family(familyId!),
      });
    },
  });

  return { children, createChild };
}
