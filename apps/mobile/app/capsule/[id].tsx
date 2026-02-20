import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { semantic, textStyles, spacing, radius } from '@/theme';
import { useCapsuleDetail } from '@/hooks/useCapsules';
import { CATEGORY_LABELS } from '@/lib/constants';

export default function CapsuleView() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: capsule, isLoading } = useCapsuleDetail(id);

  if (isLoading || !capsule) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={semantic.primary} />
      </SafeAreaView>
    );
  }

  const categoryInfo = CATEGORY_LABELS[capsule.category ?? 'other'];
  const publishedDate = capsule.published_at
    ? format(new Date(capsule.published_at), 'MMMM d, yyyy')
    : '';

  const writerInitial = capsule.writer.display_name?.charAt(0) ?? '?';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        <Pressable
          style={styles.writerRow}
          onPress={() => router.push(`/writer/${capsule.writer_id}`)}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{writerInitial}</Text>
          </View>
          <View>
            <Text style={styles.writerName}>
              {capsule.writer.display_name}
            </Text>
            {capsule.writer.relationship_label && (
              <Text style={styles.writerRelationship}>
                {capsule.writer.relationship_label}
              </Text>
            )}
          </View>
        </Pressable>

        {publishedDate ? (
          <Text style={styles.date}>{publishedDate}</Text>
        ) : null}

        {capsule.title && <Text style={styles.title}>{capsule.title}</Text>}

        {capsule.recipient?.name && (
          <Text style={styles.recipient}>For {capsule.recipient.name}</Text>
        )}

        <View style={styles.pills}>
          {categoryInfo && (
            <View style={styles.pill}>
              <Text style={styles.pillText}>
                {categoryInfo.emoji} {categoryInfo.label}
              </Text>
            </View>
          )}
          {capsule.read_time_minutes && (
            <Text style={styles.readTime}>
              {capsule.read_time_minutes} min read
            </Text>
          )}
        </View>

        <Text style={styles.body}>
          {capsule.polished_text || capsule.raw_text}
        </Text>
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
    paddingHorizontal: spacing[6],
    paddingTop: spacing[4],
    paddingBottom: spacing[12],
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
  writerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: semantic.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing[3],
  },
  avatarText: {
    ...textStyles.label,
    color: semantic.primaryDark,
    fontSize: 18,
  },
  writerName: {
    ...textStyles.label,
    color: semantic.textPrimary,
    fontSize: 16,
  },
  writerRelationship: {
    ...textStyles.caption,
    color: semantic.textSecondary,
  },
  date: {
    ...textStyles.caption,
    color: semantic.textMuted,
    marginBottom: spacing[4],
  },
  title: {
    ...textStyles.displayMedium,
    color: semantic.textPrimary,
    marginBottom: spacing[3],
  },
  recipient: {
    ...textStyles.label,
    color: semantic.secondary,
    marginBottom: spacing[3],
  },
  pills: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    marginBottom: spacing[8],
  },
  pill: {
    backgroundColor: semantic.primaryLight,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radius.full,
  },
  pillText: {
    ...textStyles.caption,
    color: semantic.primaryDark,
  },
  readTime: {
    ...textStyles.caption,
    color: semantic.textMuted,
  },
  body: {
    ...textStyles.bodyLarge,
    color: semantic.textPrimary,
    lineHeight: 32,
  },
});
