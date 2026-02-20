import { FlatList, View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { semantic, textStyles, spacing, radius } from '@/theme';
import { useAuthStore } from '@/stores/authStore';
import { useFamilyFeed } from '@/hooks/useCapsules';
import { CapsuleCard } from '@/components/capsule/CapsuleCard';
import { EmptyState } from '@/components/capsule/EmptyState';
import type { CapsuleWithWriter } from '@shared/types';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function Home() {
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);
  const { data: capsules, isLoading, refetch, isRefetching } = useFamilyFeed();

  function renderHeader() {
    return (
      <View>
        <View style={styles.header}>
          <Text style={styles.greeting}>
            {getGreeting()}
            {profile?.display_name ? `, ${profile.display_name}` : ''}
          </Text>
          <Text style={styles.title}>Family Stories</Text>
        </View>

        <View style={styles.promptCard}>
          <Text style={styles.promptLabel}>Today's prompt</Text>
          <Text style={styles.promptText}>
            Tell us about your favorite festival memory growing up...
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Recent Stories</Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={semantic.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <FlatList<CapsuleWithWriter>
        data={capsules ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <CapsuleCard
            capsule={item}
            onPress={() => router.push(`/capsule/${item.id}`)}
          />
        )}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          <EmptyState
            title="No stories yet"
            message="Tap the Write tab to create your family's first memory."
          />
        }
        contentContainerStyle={styles.content}
        onRefresh={refetch}
        refreshing={isRefetching}
        showsVerticalScrollIndicator={false}
      />
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
  header: {
    marginBottom: spacing[6],
  },
  greeting: {
    ...textStyles.bodySmall,
    color: semantic.textSecondary,
    marginBottom: spacing[1],
  },
  title: {
    ...textStyles.h1,
    color: semantic.textPrimary,
  },
  promptCard: {
    backgroundColor: semantic.primaryLight,
    padding: spacing[5],
    borderRadius: radius.lg,
    marginBottom: spacing[8],
  },
  promptLabel: {
    ...textStyles.label,
    color: semantic.primaryDark,
    marginBottom: spacing[2],
  },
  promptText: {
    ...textStyles.quote,
    color: semantic.textPrimary,
  },
  sectionTitle: {
    ...textStyles.h3,
    color: semantic.textPrimary,
    marginBottom: spacing[4],
  },
});
