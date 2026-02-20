import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { semantic, textStyles, spacing, radius } from '@/theme';
import { useWriterProfile } from '@/hooks/useProfile';
import { useWriterCapsules } from '@/hooks/useCapsules';
import { CapsuleCard } from '@/components/capsule/CapsuleCard';
import { EmptyState } from '@/components/capsule/EmptyState';
import type { CapsuleWithWriter, Capsule } from '@shared/types';

export default function WriterProfilePage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: writer, isLoading: writerLoading } = useWriterProfile(id);
  const { data: allCapsules, isLoading: capsulesLoading } =
    useWriterCapsules(id);

  const published = allCapsules?.filter((c) => !c.is_draft) ?? [];
  const isLoading = writerLoading || capsulesLoading;

  if (isLoading || !writer) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={semantic.primary} />
      </SafeAreaView>
    );
  }

  const initial = writer.display_name?.charAt(0) ?? '?';

  function capsuleToCardData(capsule: Capsule): CapsuleWithWriter {
    return {
      ...capsule,
      writer: {
        display_name: writer!.display_name,
        avatar_url: writer!.avatar_url,
        relationship_label: writer!.relationship_label,
      },
      photos: [],
      reactions: [],
    };
  }

  function renderHeader() {
    return (
      <View>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <Text style={styles.name}>{writer!.display_name}</Text>
          {writer!.relationship_label && (
            <Text style={styles.relationship}>
              {writer!.relationship_label}
            </Text>
          )}
          {writer!.bio && <Text style={styles.bio}>{writer!.bio}</Text>}
          <View style={styles.countBadge}>
            <Text style={styles.countText}>
              {published.length}{' '}
              {published.length === 1 ? 'story' : 'stories'}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>
          Stories by {writer!.display_name}
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={published}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <CapsuleCard
            capsule={capsuleToCardData(item)}
            onPress={() => router.push(`/capsule/${item.id}`)}
          />
        )}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          <EmptyState
            title="No stories yet"
            message={`${writer!.display_name} hasn't published any stories yet.`}
          />
        }
        contentContainerStyle={styles.content}
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
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: spacing[2],
    marginBottom: spacing[6],
  },
  backText: {
    ...textStyles.body,
    color: semantic.primary,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: spacing[8],
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: semantic.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[4],
  },
  avatarText: {
    ...textStyles.h1,
    color: semantic.primaryDark,
  },
  name: {
    ...textStyles.h1,
    color: semantic.textPrimary,
    marginBottom: spacing[1],
  },
  relationship: {
    ...textStyles.body,
    color: semantic.primary,
    marginBottom: spacing[2],
  },
  bio: {
    ...textStyles.body,
    color: semantic.textSecondary,
    textAlign: 'center',
    marginBottom: spacing[3],
  },
  countBadge: {
    backgroundColor: semantic.primaryLight,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[1],
    borderRadius: radius.full,
  },
  countText: {
    ...textStyles.caption,
    color: semantic.primaryDark,
  },
  sectionTitle: {
    ...textStyles.h3,
    color: semantic.textPrimary,
    marginBottom: spacing[4],
  },
});
