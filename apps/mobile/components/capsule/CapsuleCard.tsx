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
  // Locked non-surprise capsule: show sealed envelope
  if (!capsule.is_unlocked && !capsule.is_surprise) {
    return <LockedCapsuleCard capsule={capsule} onPress={onPress} />;
  }

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
        {capsule.audio_url && (
          <View style={styles.audioPill}>
            <Text style={styles.audioPillText}>
              🎙️ {capsule.audio_duration_seconds
                ? `${Math.floor(capsule.audio_duration_seconds / 60)}:${String(Math.floor(capsule.audio_duration_seconds % 60)).padStart(2, '0')}`
                : 'Audio'}
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

function LockedCapsuleCard({
  capsule,
  onPress,
}: {
  capsule: CapsuleWithWriter;
  onPress: () => void;
}) {
  const writerInitial = capsule.writer.display_name?.charAt(0) ?? '?';

  let unlockLabel = 'Time capsule';
  if (capsule.unlock_type === 'date' && capsule.unlock_date) {
    unlockLabel = `Opens ${formatDistanceToNow(new Date(capsule.unlock_date), { addSuffix: true })}`;
  } else if (capsule.unlock_type === 'age' && capsule.unlock_age) {
    unlockLabel = `Opens at age ${capsule.unlock_age}`;
  } else if (capsule.unlock_type === 'milestone' && capsule.unlock_milestone) {
    unlockLabel = `Opens at: ${capsule.unlock_milestone}`;
  }

  return (
    <Pressable style={styles.lockedCard} onPress={onPress}>
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
        </View>
      </View>

      <View style={styles.lockedBody}>
        <Text style={styles.lockedEmoji}>🔒</Text>
        <Text style={styles.lockedLabel}>Sealed Story</Text>
        <Text style={styles.lockedUnlock}>{unlockLabel}</Text>
      </View>

      {capsule.recipient?.name && (
        <Text style={styles.lockedRecipient}>
          For {capsule.recipient.name}
        </Text>
      )}
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
  audioPill: {
    backgroundColor: colors.terracotta[300] + '30',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radius.full,
  },
  audioPillText: {
    ...textStyles.caption,
    color: colors.terracotta[600],
  },
  // Locked card
  lockedCard: {
    backgroundColor: semantic.lockedCapsule,
    borderRadius: radius.lg,
    padding: spacing[5],
    marginBottom: spacing[4],
    borderWidth: 1,
    borderColor: colors.locked + '30',
    ...shadow.sm,
  },
  lockedBody: {
    alignItems: 'center',
    paddingVertical: spacing[6],
  },
  lockedEmoji: {
    fontSize: 28,
    marginBottom: spacing[2],
  },
  lockedLabel: {
    ...textStyles.h3,
    color: colors.locked,
    marginBottom: spacing[1],
  },
  lockedUnlock: {
    ...textStyles.caption,
    color: semantic.textSecondary,
  },
  lockedRecipient: {
    ...textStyles.caption,
    color: semantic.secondary,
    textAlign: 'center',
  },
});
