import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { semantic, textStyles, spacing } from '@/theme';
import { useAuthStore } from '@/stores/authStore';
import { debug } from '@/lib/debug';

/**
 * Root index — checks auth state and redirects.
 * Shows a brief splash with the Katha name while loading.
 */
export default function Index() {
  const router = useRouter();
  const isLoading = useAuthStore((s) => s.isLoading);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const profile = useAuthStore((s) => s.profile);

  useEffect(() => {
    debug.log('Index', 'routing check — isLoading:', isLoading, 'isAuthenticated:', isAuthenticated, 'familyId:', profile?.family_id, 'role:', profile?.role);
    if (isLoading) return;

    if (!isAuthenticated) {
      debug.log('Index', '→ navigating to welcome (not authenticated)');
      router.replace('/(auth)/welcome');
    } else if (!profile?.family_id) {
      // Authenticated but no family — send to create or join
      if (profile?.role === 'guardian') {
        debug.log('Index', '→ navigating to create-family (guardian, no family)');
        router.replace('/(auth)/create-family');
      } else {
        debug.log('Index', '→ navigating to join (writer, no family)');
        router.replace('/(auth)/join');
      }
    } else {
      debug.log('Index', '→ navigating to home (authenticated, has family)');
      router.replace('/(tabs)/home');
    }
  }, [isLoading, isAuthenticated, profile]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>कथा</Text>
      <Text style={styles.subtitle}>Katha</Text>
      <Text style={styles.tagline}>Family Stories, Forever</Text>
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
  title: {
    fontSize: 72,
    color: semantic.primary,
    marginBottom: spacing[2],
  },
  subtitle: {
    ...textStyles.displayMedium,
    color: semantic.textPrimary,
    marginBottom: spacing[3],
  },
  tagline: {
    ...textStyles.bodyLarge,
    color: semantic.textSecondary,
  },
});
