import { Pressable, View, Text, StyleSheet } from 'react-native';
import { formatDistanceToNow } from 'date-fns';
import type { CapsuleWithWriter } from '@shared/types';
import { semantic, textStyles, spacing, radius, shadow, colors } from '@/theme';
import { CATEGORY_LABELS } from '@/lib/constants';

interface CapsuleCardProps {
  capsule: CapsuleWithWriter;
  onPress: () => void;
}

export function CapsuleCard({ capsule, onPress }: CapsuleCardProps) {
  const categoryInfo = CATEGORY_LABELS[capsule.category ?? 'other'];
  const timeAgo = capsule.published_at
    ? formatDistanceToNow(new Date(capsule.published_at), { addSuffix: true })
    : '';

  const writerInitial = capsule.writer.display_name?.charAt(0) ?? '?';

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{writerInitial}</Text>
        </View>
        <View style={styles.headerText}>
          <Text style={styles.writerName} numberOfLines={1}>
            {capsule.writer.display_name}
            {capsule.writer.relationship_label && (
              <Text style={styles.relationship}>
                {' '}
                · {capsule.writer.relationship_label}
              </Text>
            )}
          </Text>
          {timeAgo ? <Text style={styles.timeAgo}>{timeAgo}</Text> : null}
        </View>
      </View>

      {capsule.title && (
        <Text style={styles.title} numberOfLines={2}>
          {capsule.title}
        </Text>
      )}

      {capsule.excerpt && (
        <Text style={styles.excerpt} numberOfLines={3}>
          {capsule.excerpt}
        </Text>
      )}

      <View style={styles.footer}>
        {categoryInfo && (
          <View style={styles.pill}>
            <Text style={styles.pillText}>
              {categoryInfo.emoji} {categoryInfo.label}
            </Text>
          </View>
        )}
        {capsule.recipient?.name && (
          <Text style={styles.recipient}>For {capsule.recipient.name}</Text>
        )}
        {capsule.read_time_minutes && (
          <Text style={styles.readTime}>
            {capsule.read_time_minutes} min read
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: semantic.capsuleCard,
    borderRadius: radius.lg,
    padding: spacing[5],
    marginBottom: spacing[4],
    ...shadow.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: semantic.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing[3],
  },
  avatarText: {
    ...textStyles.label,
    color: semantic.primaryDark,
  },
  headerText: {
    flex: 1,
  },
  writerName: {
    ...textStyles.label,
    color: semantic.textPrimary,
  },
  relationship: {
    ...textStyles.caption,
    color: semantic.textSecondary,
    fontWeight: '400',
  },
  timeAgo: {
    ...textStyles.caption,
    color: semantic.textMuted,
    marginTop: 2,
  },
  title: {
    ...textStyles.h3,
    color: semantic.textPrimary,
    marginBottom: spacing[2],
  },
  excerpt: {
    ...textStyles.body,
    color: semantic.textSecondary,
    marginBottom: spacing[3],
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    flexWrap: 'wrap',
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
  recipient: {
    ...textStyles.caption,
    color: semantic.secondary,
  },
  readTime: {
    ...textStyles.caption,
    color: semantic.textMuted,
  },
});
