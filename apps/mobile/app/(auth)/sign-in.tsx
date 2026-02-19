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
import { useAuth } from '@/hooks/useAuth';

export default function SignIn() {
  const router = useRouter();
  const { signIn } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSignIn() {
    setError(null);
    setIsSubmitting(true);

    const result = await signIn({
      email: email.trim(),
      password,
    });

    setIsSubmitting(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    // Auth listener in _layout.tsx will handle navigation via index.tsx.
    // But we also navigate directly for immediate feedback.
    router.replace('/');
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
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>
            Sign in to continue your family's stories
          </Text>
        </View>

        <View style={styles.form}>
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
            placeholder="Enter your password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="current-password"
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <Button
            label="Sign In"
            onPress={handleSignIn}
            loading={isSubmitting}
          />
        </View>

        <Pressable
          style={styles.footer}
          onPress={() => router.push('/(auth)/sign-up')}
        >
          <Text style={styles.footerText}>
            Don't have an account?{' '}
            <Text style={styles.footerLink}>Sign up</Text>
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
