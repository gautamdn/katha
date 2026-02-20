export const queryKeys = {
  capsules: {
    all: ['capsules'] as const,
    family: (familyId: string) => ['capsules', 'family', familyId] as const,
    writer: (writerId: string) => ['capsules', 'writer', writerId] as const,
    detail: (capsuleId: string) => ['capsules', 'detail', capsuleId] as const,
  },
  children: {
    family: (familyId: string) => ['children', 'family', familyId] as const,
  },
  profiles: {
    detail: (userId: string) => ['profiles', userId] as const,
    familyMembers: (familyId: string) =>
      ['profiles', 'family', familyId] as const,
  },
  families: {
    detail: (familyId: string) => ['families', familyId] as const,
  },
};
