import { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  type TextInputProps,
} from 'react-native';
import { semantic, colors, textStyles, spacing, radius, fontSize } from '@/theme';

interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string;
}

export function Input({ label, error, ...inputProps }: InputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        style={[
          styles.input,
          focused && styles.inputFocused,
          error && styles.inputError,
        ]}
        placeholderTextColor={semantic.textMuted}
        onFocus={(e) => {
          setFocused(true);
          inputProps.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          inputProps.onBlur?.(e);
        }}
        {...inputProps}
      />
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing[2],
  },
  label: {
    ...textStyles.label,
    color: semantic.textSecondary,
  },
  input: {
    backgroundColor: semantic.surface,
    borderWidth: 1,
    borderColor: semantic.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing[4],
    minHeight: 56,
    ...textStyles.body,
    color: semantic.textPrimary,
  },
  inputFocused: {
    borderColor: semantic.primary,
  },
  inputError: {
    borderColor: colors.error,
  },
  error: {
    ...textStyles.caption,
    color: colors.error,
  },
});
