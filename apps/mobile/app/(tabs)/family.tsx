import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { semantic, textStyles, spacing, radius } from '@/theme';
import { useAuthStore } from '@/stores/authStore';
import { useFamilyInfo } from '@/hooks/useFamily';
import { useFamilyMembers } from '@/hooks/useProfile';
import { useChildren } from '@/hooks/useChildren';
import { WriterCard } from '@/components/writer/WriterCard';
import { ChildCard } from '@/components/family/ChildCard';
import { AddChildForm } from '@/components/family/AddChildForm';

export default function FamilyScreen() {
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);
  const isGuardian = profile?.role === 'guardian';

  const { data: family, isLoading: familyLoading } = useFamilyInfo();
  const { data: members, isLoading: membersLoading } = useFamilyMembers();
  const { children, createChild } = useChildren();

  const isLoading = familyLoading || membersLoading;

  if (isLoading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={semantic.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>{family?.name ?? 'My Family'}</Text>

        {isGuardian && family?.invite_code && (
          <View style={styles.codeCard}>
            <Text style={styles.codeLabel}>Family invite code</Text>
            <Text style={styles.code}>{family.invite_code}</Text>
            <Text style={styles.codeHint}>
              Share this code with writers so they can join your family
            </Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Members</Text>
          {members?.map((member) => (
            <WriterCard
              key={member.id}
              writer={member}
              onPress={() => router.push(`/writer/${member.id}`)}
            />
          ))}
          {(!members || members.length === 0) && (
            <Text style={styles.emptyText}>No members yet</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Children</Text>
          {children.data?.map((child) => (
            <ChildCard key={child.id} child={child} />
          ))}
          {(!children.data || children.data.length === 0) && (
            <Text style={styles.emptyText}>
              No children added yet.
              {isGuardian
                ? ' Add your children below.'
                : ' Ask a guardian to add children.'}
            </Text>
          )}
        </View>

        {isGuardian && (
          <View style={styles.section}>
            <AddChildForm
              onSubmit={(data) =>
                createChild.mutate({
                  name: data.name,
                  dateOfBirth: data.dateOfBirth,
                })
              }
              isLoading={createChild.isPending}
              error={
                createChild.error instanceof Error
                  ? createChild.error.message
                  : null
              }
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: semantic.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: semantic.background,
  },
  content: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[10],
  },
  title: {
    ...textStyles.h1,
    color: semantic.textPrimary,
    marginBottom: spacing[6],
  },
  codeCard: {
    backgroundColor: semantic.primaryLight,
    borderRadius: radius.xl,
    padding: spacing[5],
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: spacing[8],
  },
  codeLabel: {
    ...textStyles.label,
    color: semantic.textSecondary,
  },
  code: {
    ...textStyles.h2,
    color: semantic.primaryDark,
    letterSpacing: 4,
  },
  codeHint: {
    ...textStyles.caption,
    color: semantic.textSecondary,
    textAlign: 'center',
  },
  section: {
    marginBottom: spacing[8],
  },
  sectionTitle: {
    ...textStyles.h3,
    color: semantic.textPrimary,
    marginBottom: spacing[4],
  },
  emptyText: {
    ...textStyles.body,
    color: semantic.textMuted,
  },
});
