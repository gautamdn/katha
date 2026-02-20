import { View, Text, StyleSheet } from 'react-native';
import { differenceInYears } from 'date-fns';
import type { Child } from '@shared/types';
import { semantic, textStyles, spacing, radius, shadow } from '@/theme';

interface ChildCardProps {
  child: Child;
}

export function ChildCard({ child }: ChildCardProps) {
  const age = differenceInYears(new Date(), new Date(child.date_of_birth));
  const initial = child.name.charAt(0).toUpperCase();

  return (
    <View style={styles.card}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initial}</Text>
      </View>
      <View>
        <Text style={styles.name}>{child.name}</Text>
        <Text style={styles.age}>
          {age} {age === 1 ? 'year' : 'years'} old
        </Text>
      </View>
    </View>
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
    backgroundColor: semantic.secondaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing[4],
  },
  avatarText: {
    ...textStyles.label,
    color: semantic.secondary,
    fontSize: 18,
  },
  name: {
    ...textStyles.label,
    color: semantic.textPrimary,
    fontSize: 16,
  },
  age: {
    ...textStyles.caption,
    color: semantic.textSecondary,
    marginTop: 2,
  },
});
