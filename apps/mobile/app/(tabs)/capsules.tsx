import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatDistanceToNow } from 'date-fns';
import { semantic, textStyles, spacing, radius, shadow } from '@/theme';
import { useWriterCapsules } from '@/hooks/useCapsules';
import { CapsuleCard } from '@/components/capsule/CapsuleCard';
import { EmptyState } from '@/components/capsule/EmptyState';
import type { Capsule, CapsuleWithWriter } from '@shared/types';
import { useAuthStore } from '@/stores/authStore';

export default function CapsulesScreen() {
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);
  const { data: allCapsules, isLoading } = useWriterCapsules();

  const drafts = allCapsules?.filter((c) => c.is_draft) ?? [];
  const published = allCapsules?.filter((c) => !c.is_draft) ?? [];

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
        <Text style={styles.title}>Your Stories</Text>

        {drafts.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Drafts</Text>
            {drafts.map((draft) => (
              <Pressable key={draft.id} style={styles.draftCard}>
                <Text style={styles.draftText} numberOfLines={2}>
                  {draft.raw_text}
                </Text>
                <Text style={styles.draftDate}>
                  {formatDistanceToNow(new Date(draft.created_at), {
                    addSuffix: true,
                  })}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Published</Text>
          {published.length > 0 ? (
            published.map((capsule) => (
              <CapsuleCard
                key={capsule.id}
                capsule={
                  {
                    ...capsule,
                    writer: {
                      display_name: profile?.display_name ?? '',
                      avatar_url: profile?.avatar_url ?? null,
                      relationship_label: profile?.relationship_label ?? null,
                    },
                    photos: [],
                    reactions: [],
                  } as CapsuleWithWriter
                }
                onPress={() => router.push(`/capsule/${capsule.id}`)}
              />
            ))
          ) : (
            <EmptyState
              title="No published stories"
              message="Your published stories will appear here."
            />
          )}
        </View>
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
  section: {
    marginBottom: spacing[8],
  },
  sectionTitle: {
    ...textStyles.h3,
    color: semantic.textPrimary,
    marginBottom: spacing[4],
  },
  draftCard: {
    backgroundColor: semantic.surface,
    borderRadius: radius.md,
    padding: spacing[4],
    marginBottom: spacing[3],
    borderLeftWidth: 3,
    borderLeftColor: semantic.primary,
    ...shadow.sm,
  },
  draftText: {
    ...textStyles.body,
    color: semantic.textPrimary,
    marginBottom: spacing[2],
  },
  draftDate: {
    ...textStyles.caption,
    color: semantic.textMuted,
  },
});
