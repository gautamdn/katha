import { Pressable, View, Text, StyleSheet } from 'react-native';
import type { Profile } from '@shared/types';
import { semantic, textStyles, spacing, radius, shadow } from '@/theme';

interface WriterCardProps {
  writer: Profile;
  onPress: () => void;
}

export function WriterCard({ writer, onPress }: WriterCardProps) {
  const initial = writer.display_name?.charAt(0) ?? '?';

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initial}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {writer.display_name}
        </Text>
        {writer.relationship_label && (
          <Text style={styles.relationship}>{writer.relationship_label}</Text>
        )}
      </View>
      {writer.role === 'guardian' && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Guardian</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: semantic.surface,
    borderRadius: radius.md,
    padding: spacing[4],
    marginBottom: spacing[3],
    ...shadow.sm,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: semantic.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing[4],
  },
  avatarText: {
    ...textStyles.label,
    color: semantic.primaryDark,
    fontSize: 18,
  },
  info: {
    flex: 1,
  },
  name: {
    ...textStyles.label,
    color: semantic.textPrimary,
    fontSize: 16,
  },
  relationship: {
    ...textStyles.caption,
    color: semantic.textSecondary,
    marginTop: 2,
  },
  badge: {
    backgroundColor: semantic.primaryLight,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radius.full,
  },
  badgeText: {
    ...textStyles.caption,
    color: semantic.primaryDark,
  },
});
