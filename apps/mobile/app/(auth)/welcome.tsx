import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { semantic, textStyles, spacing, radius } from '@/theme';

/**
 * Welcome screen — warm onboarding entry point.
 * 
 * TODO:
 * - Add 3-slide onboarding carousel (Record → Preserve → Unlock)
 * - Add warm illustration/hero image
 * - Add "Sign in" and "Get started" buttons
 * - Add "Join a family" for invited writers
 */
export default function Welcome() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.devanagari}>कथा</Text>
        <Text style={styles.title}>Katha</Text>
        <Text style={styles.tagline}>Family Stories, Forever</Text>
      </View>

      <View style={styles.description}>
        <Text style={styles.body}>
          Record your family's stories today.{'\n'}
          Your children will unwrap them tomorrow.
        </Text>
      </View>

      <View style={styles.actions}>
        <Pressable 
          style={styles.primaryButton} 
          onPress={() => {
            // TODO: Navigate to sign up flow
            // router.push('/(auth)/signup');
          }}
        >
          <Text style={styles.primaryButtonText}>Get Started</Text>
        </Pressable>

        <Pressable 
          style={styles.secondaryButton}
          onPress={() => {
            // TODO: Navigate to sign in
            // router.push('/(auth)/signin');
          }}
        >
          <Text style={styles.secondaryButtonText}>I have an account</Text>
        </Pressable>

        <Pressable 
          style={styles.linkButton}
          onPress={() => {
            // TODO: Navigate to join family flow
            // router.push('/(auth)/join');
          }}
        >
          <Text style={styles.linkButtonText}>Join a family with invite code</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: semantic.background,
    paddingHorizontal: spacing[6],
  },
  hero: {
    alignItems: 'center',
    marginBottom: spacing[10],
  },
  devanagari: {
    fontSize: 56,
    color: semantic.primary,
    marginBottom: spacing[1],
  },
  title: {
    ...textStyles.displayLarge,
    color: semantic.textPrimary,
  },
  tagline: {
    ...textStyles.bodyLarge,
    color: semantic.textSecondary,
    marginTop: spacing[2],
  },
  description: {
    marginBottom: spacing[12],
    paddingHorizontal: spacing[4],
  },
  body: {
    ...textStyles.body,
    color: semantic.textSecondary,
    textAlign: 'center',
    lineHeight: 26,
  },
  actions: {
    width: '100%',
    gap: spacing[4],
  },
  primaryButton: {
    backgroundColor: semantic.primary,
    paddingVertical: spacing[4],
    borderRadius: radius.lg,
    alignItems: 'center',
    minHeight: 56,
    justifyContent: 'center',
  },
  primaryButtonText: {
    ...textStyles.button,
    color: '#FFFFFF',
  },
  secondaryButton: {
    borderWidth: 1.5,
    borderColor: semantic.primary,
    paddingVertical: spacing[4],
    borderRadius: radius.lg,
    alignItems: 'center',
    minHeight: 56,
    justifyContent: 'center',
  },
  secondaryButtonText: {
    ...textStyles.button,
    color: semantic.primary,
  },
  linkButton: {
    paddingVertical: spacing[3],
    alignItems: 'center',
  },
  linkButtonText: {
    ...textStyles.bodySmall,
    color: semantic.textSecondary,
    textDecorationLine: 'underline',
  },
});
