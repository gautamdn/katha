import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { semantic, textStyles, spacing, radius } from '@/theme';

type ButtonVariant = 'primary' | 'secondary' | 'link';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      style={[
        styles.base,
        variant === 'primary' && styles.primary,
        variant === 'secondary' && styles.secondary,
        variant === 'link' && styles.link,
        isDisabled && styles.disabled,
      ]}
      onPress={onPress}
      disabled={isDisabled}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' ? '#FFFFFF' : semantic.primary}
        />
      ) : (
        <Text
          style={[
            styles.label,
            variant === 'primary' && styles.primaryLabel,
            variant === 'secondary' && styles.secondaryLabel,
            variant === 'link' && styles.linkLabel,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    width: '100%',
  },
  primary: {
    backgroundColor: semantic.primary,
    paddingVertical: spacing[4],
    minHeight: 56,
  },
  secondary: {
    borderWidth: 1.5,
    borderColor: semantic.primary,
    paddingVertical: spacing[4],
    minHeight: 56,
  },
  link: {
    paddingVertical: spacing[3],
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    ...textStyles.button,
  },
  primaryLabel: {
    color: '#FFFFFF',
  },
  secondaryLabel: {
    color: semantic.primary,
  },
  linkLabel: {
    ...textStyles.bodySmall,
    color: semantic.textSecondary,
    textDecorationLine: 'underline',
  },
});
