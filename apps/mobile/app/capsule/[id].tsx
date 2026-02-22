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
import { semantic, textStyles, spacing, radius, colors } from '@/theme';
import { useCapsuleDetail } from '@/hooks/useCapsules';
import { useAuthStore } from '@/stores/authStore';
import { AudioPlayer } from '@/components/audio/AudioPlayer';
import { CATEGORY_LABELS } from '@/lib/constants';

export default function CapsuleView() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: capsule, isLoading } = useCapsuleDetail(id);
  const user = useAuthStore((s) => s.user);

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

        {/* Locked capsule state */}
        {!capsule.is_unlocked && capsule.writer_id !== user?.id && (
          <View style={styles.lockedBanner}>
            <Text style={styles.lockedIcon}>🔒</Text>
            <Text style={styles.lockedText}>
              This story is sealed as a time capsule
            </Text>
            {capsule.unlock_type === 'date' && capsule.unlock_date && (
              <Text style={styles.lockedDetail}>
                Opens on{' '}
                {format(new Date(capsule.unlock_date), 'MMMM d, yyyy')}
              </Text>
            )}
            {capsule.unlock_type === 'age' && capsule.unlock_age && (
              <Text style={styles.lockedDetail}>
                Opens when the recipient turns {capsule.unlock_age}
              </Text>
            )}
            {capsule.unlock_type === 'milestone' && capsule.unlock_milestone && (
              <Text style={styles.lockedDetail}>
                Opens at: {capsule.unlock_milestone}
              </Text>
            )}
          </View>
        )}

        {/* Audio player (show when unlocked or writer is viewing) */}
        {capsule.audio_url &&
          (capsule.is_unlocked || capsule.writer_id === user?.id) && (
            <View style={styles.audioSection}>
              <AudioPlayer
                audioUrl={capsule.audio_url}
                durationSeconds={capsule.audio_duration_seconds ?? undefined}
                writerName={capsule.writer.relationship_label ?? capsule.writer.display_name}
              />
            </View>
          )}

        {/* Body text (show when unlocked or writer is viewing) */}
        {(capsule.is_unlocked || capsule.writer_id === user?.id) && (
          <Text style={styles.body}>
            {capsule.polished_text || capsule.raw_text}
          </Text>
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
  audioSection: {
    marginBottom: spacing[8],
  },
  lockedBanner: {
    backgroundColor: semantic.lockedCapsule,
    borderRadius: radius.lg,
    padding: spacing[6],
    alignItems: 'center',
    marginBottom: spacing[6],
  },
  lockedIcon: {
    fontSize: 32,
    marginBottom: spacing[3],
  },
  lockedText: {
    ...textStyles.h3,
    color: colors.locked,
    textAlign: 'center',
    marginBottom: spacing[2],
  },
  lockedDetail: {
    ...textStyles.body,
    color: semantic.textSecondary,
    textAlign: 'center',
  },
});
