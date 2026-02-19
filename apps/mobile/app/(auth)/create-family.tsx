import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { semantic, textStyles, spacing, radius } from '@/theme';
import { Button, Input } from '@/components/ui';
import { useFamily } from '@/hooks/useFamily';

export default function CreateFamily() {
  const router = useRouter();
  const { createFamily } = useFamily();

  const [familyName, setFamilyName] = useState('');
  const [inviteCode, setInviteCode] = useState<string | null>(null);

  function handleCreate() {
    createFamily.mutate(
      { name: familyName.trim() },
      {
        onSuccess: (family) => {
          setInviteCode(family.invite_code);
        },
      },
    );
  }

  // After family is created, show the invite code
  if (inviteCode) {
    return (
      <View style={styles.successContainer}>
        <Text style={styles.successTitle}>Your family is ready!</Text>

        <View style={styles.codeCard}>
          <Text style={styles.codeLabel}>Your family invite code</Text>
          <Text style={styles.code}>{inviteCode}</Text>
          <Text style={styles.codeHint}>
            Share this code with grandparents and writers so they can join your
            family's Katha.
          </Text>
        </View>

        <Button
          label="Continue to Home"
          onPress={() => router.replace('/(tabs)/home')}
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.title}>Create your family</Text>
          <Text style={styles.subtitle}>
            Give your family a name to get started
          </Text>
        </View>

        <View style={styles.form}>
          <Input
            label="Family name"
            placeholder="e.g., The Sharma Family"
            value={familyName}
            onChangeText={setFamilyName}
            autoCapitalize="words"
          />

          {createFamily.error && (
            <Text style={styles.error}>
              {createFamily.error instanceof Error
                ? createFamily.error.message
                : 'Something went wrong. Please try again.'}
            </Text>
          )}

          <Button
            label="Create Family"
            onPress={handleCreate}
            loading={createFamily.isPending}
            disabled={familyName.trim().length === 0}
          />

          <Text style={styles.hint}>
            You'll get an invite code to share with your family's writers.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: semantic.background,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: spacing[6],
    paddingTop: spacing[16],
    paddingBottom: spacing[8],
    justifyContent: 'center',
  },
  header: {
    marginBottom: spacing[8],
  },
  title: {
    ...textStyles.h1,
    color: semantic.textPrimary,
    marginBottom: spacing[2],
  },
  subtitle: {
    ...textStyles.body,
    color: semantic.textSecondary,
  },
  form: {
    gap: spacing[5],
  },
  error: {
    ...textStyles.bodySmall,
    color: '#DC2626',
    textAlign: 'center',
  },
  hint: {
    ...textStyles.caption,
    color: semantic.textMuted,
    textAlign: 'center',
  },
  // Success state
  successContainer: {
    flex: 1,
    backgroundColor: semantic.background,
    paddingHorizontal: spacing[6],
    justifyContent: 'center',
    gap: spacing[8],
  },
  successTitle: {
    ...textStyles.h1,
    color: semantic.textPrimary,
    textAlign: 'center',
  },
  codeCard: {
    backgroundColor: semantic.primaryLight,
    borderRadius: radius.xl,
    padding: spacing[6],
    alignItems: 'center',
    gap: spacing[3],
  },
  codeLabel: {
    ...textStyles.label,
    color: semantic.textSecondary,
  },
  code: {
    ...textStyles.h2,
    color: semantic.primaryDark,
    letterSpacing: 4,
  },
  codeHint: {
    ...textStyles.bodySmall,
    color: semantic.textSecondary,
    textAlign: 'center',
  },
});
