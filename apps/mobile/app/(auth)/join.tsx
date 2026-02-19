import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { semantic, textStyles, spacing, colors } from '@/theme';
import { Button, Input } from '@/components/ui';
import { useFamily } from '@/hooks/useFamily';

function friendlyJoinError(error: unknown): string {
  if (error instanceof Error) {
    if (error.message === 'INVALID_INVITE_CODE') {
      return "We couldn't find a family with that code. Please check and try again.";
    }
  }
  return 'Something went wrong. Please try again.';
}

export default function JoinFamily() {
  const router = useRouter();
  const { joinFamily } = useFamily();

  const [inviteCode, setInviteCode] = useState('');
  const [relationshipLabel, setRelationshipLabel] = useState('');

  function handleJoin() {
    joinFamily.mutate(
      {
        inviteCode: inviteCode.trim().toLowerCase(),
        relationshipLabel: relationshipLabel.trim() || undefined,
      },
      {
        onSuccess: () => {
          router.replace('/(tabs)/home');
        },
      },
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
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        <View style={styles.header}>
          <Text style={styles.title}>Join your family</Text>
          <Text style={styles.subtitle}>
            Enter the invite code shared by your family's guardian
          </Text>
        </View>

        <View style={styles.form}>
          <Input
            label="Invite code"
            placeholder="e.g., ab3f29c1"
            value={inviteCode}
            onChangeText={setInviteCode}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={8}
          />

          <Input
            label="What should the children call you?"
            placeholder="e.g., Nani, Dada, Grandma"
            value={relationshipLabel}
            onChangeText={setRelationshipLabel}
            autoCapitalize="words"
          />

          {joinFamily.error && (
            <Text style={styles.error}>
              {friendlyJoinError(joinFamily.error)}
            </Text>
          )}

          <Button
            label="Join Family"
            onPress={handleJoin}
            loading={joinFamily.isPending}
            disabled={inviteCode.trim().length !== 8}
          />
        </View>

        <Text style={styles.footer}>
          Don't have a code? Ask your family's guardian to invite you.
        </Text>
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
    color: colors.error,
    textAlign: 'center',
  },
  footer: {
    ...textStyles.caption,
    color: semantic.textMuted,
    textAlign: 'center',
    marginTop: spacing[8],
  },
});
