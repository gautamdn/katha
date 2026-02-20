import { View, Text, StyleSheet } from 'react-native';
import { semantic, textStyles, spacing } from '@/theme';
import { Button } from '@/components/ui';

interface EmptyStateProps {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  title,
  message,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {actionLabel && onAction && (
        <View style={styles.action}>
          <Button label={actionLabel} onPress={onAction} variant="secondary" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: spacing[12],
    paddingHorizontal: spacing[6],
  },
  title: {
    ...textStyles.h2,
    color: semantic.textPrimary,
    textAlign: 'center',
    marginBottom: spacing[3],
  },
  message: {
    ...textStyles.body,
    color: semantic.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  action: {
    marginTop: spacing[6],
    width: '100%',
    maxWidth: 240,
  },
});
