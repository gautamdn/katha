import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { semantic, textStyles, spacing, colors } from '@/theme';
import { Button, Input } from '@/components/ui';

interface AddChildFormProps {
  onSubmit: (data: { name: string; dateOfBirth: string }) => void;
  isLoading: boolean;
  error?: string | null;
}

export function AddChildForm({ onSubmit, isLoading, error }: AddChildFormProps) {
  const [name, setName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');

  function handleSubmit() {
    if (!name.trim() || !dateOfBirth.trim()) return;
    onSubmit({ name: name.trim(), dateOfBirth: dateOfBirth.trim() });
    setName('');
    setDateOfBirth('');
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Add a child</Text>

      <View style={styles.form}>
        <Input
          label="Child's name"
          placeholder="e.g., Aarav"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
        />

        <Input
          label="Date of birth"
          placeholder="YYYY-MM-DD"
          value={dateOfBirth}
          onChangeText={setDateOfBirth}
          keyboardType="numbers-and-punctuation"
          autoCapitalize="none"
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <Button
          label="Add Child"
          onPress={handleSubmit}
          loading={isLoading}
          disabled={!name.trim() || !dateOfBirth.trim()}
          variant="secondary"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing[3],
  },
  title: {
    ...textStyles.h3,
    color: semantic.textPrimary,
  },
  form: {
    gap: spacing[4],
  },
  error: {
    ...textStyles.caption,
    color: colors.error,
    textAlign: 'center',
  },
});
