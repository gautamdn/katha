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
import { semantic, textStyles, spacing, radius, colors } from '@/theme';
import { Button, Input } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';

type Role = 'guardian' | 'writer';

export default function SignUp() {
  const router = useRouter();
  const { signUp } = useAuth();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('guardian');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSignUp() {
    setError(null);
    setIsSubmitting(true);

    const result = await signUp({
      email: email.trim(),
      password,
      display_name: displayName.trim(),
      role,
    });

    setIsSubmitting(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    // Navigate based on role
    if (role === 'guardian') {
      router.replace('/(auth)/create-family');
    } else {
      router.replace('/(auth)/join');
    }
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
          <Text style={styles.title}>Create your account</Text>
          <Text style={styles.subtitle}>
            Start preserving your family's stories
          </Text>
        </View>

        <View style={styles.form}>
          <Input
            label="Your name"
            placeholder="e.g., Sunita Sharma"
            value={displayName}
            onChangeText={setDisplayName}
            autoCapitalize="words"
            autoComplete="name"
          />

          <Input
            label="Email"
            placeholder="you@example.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />

          <Input
            label="Password"
            placeholder="At least 8 characters"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
          />

          <View style={styles.roleSection}>
            <Text style={styles.roleLabel}>I am a...</Text>
            <View style={styles.roleCards}>
              <Pressable
                style={[
                  styles.roleCard,
                  role === 'guardian' && styles.roleCardSelected,
                ]}
                onPress={() => setRole('guardian')}
              >
                <Text
                  style={[
                    styles.roleTitle,
                    role === 'guardian' && styles.roleTitleSelected,
                  ]}
                >
                  Guardian
                </Text>
                <Text style={styles.roleDesc}>
                  I'll manage my family's Katha
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.roleCard,
                  role === 'writer' && styles.roleCardSelected,
                ]}
                onPress={() => setRole('writer')}
              >
                <Text
                  style={[
                    styles.roleTitle,
                    role === 'writer' && styles.roleTitleSelected,
                  ]}
                >
                  Writer
                </Text>
                <Text style={styles.roleDesc}>
                  I'll record stories for my family
                </Text>
              </Pressable>
            </View>
          </View>

          {error && <Text style={styles.error}>{error}</Text>}

          <Button
            label="Create Account"
            onPress={handleSignUp}
            loading={isSubmitting}
          />
        </View>

        <Pressable
          style={styles.footer}
          onPress={() => router.push('/(auth)/sign-in')}
        >
          <Text style={styles.footerText}>
            Already have an account?{' '}
            <Text style={styles.footerLink}>Sign in</Text>
          </Text>
        </Pressable>
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
  roleSection: {
    gap: spacing[3],
  },
  roleLabel: {
    ...textStyles.label,
    color: semantic.textSecondary,
  },
  roleCards: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  roleCard: {
    flex: 1,
    backgroundColor: semantic.surface,
    borderWidth: 1.5,
    borderColor: semantic.border,
    borderRadius: radius.md,
    padding: spacing[4],
    minHeight: 80,
    justifyContent: 'center',
  },
  roleCardSelected: {
    borderColor: semantic.primary,
    backgroundColor: semantic.primaryLight,
  },
  roleTitle: {
    ...textStyles.label,
    color: semantic.textPrimary,
    marginBottom: spacing[1],
  },
  roleTitleSelected: {
    color: semantic.primaryDark,
  },
  roleDesc: {
    ...textStyles.caption,
    color: semantic.textSecondary,
  },
  error: {
    ...textStyles.bodySmall,
    color: colors.error,
    textAlign: 'center',
  },
  footer: {
    marginTop: spacing[8],
    alignItems: 'center',
    paddingVertical: spacing[4],
  },
  footerText: {
    ...textStyles.bodySmall,
    color: semantic.textSecondary,
  },
  footerLink: {
    color: semantic.primary,
    fontWeight: '600',
  },
});
