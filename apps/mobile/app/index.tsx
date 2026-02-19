import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { semantic, textStyles, spacing } from '@/theme';

/**
 * Root index — checks auth state and redirects.
 * Shows a brief splash with the Katha name while loading.
 */
export default function Index() {
  const router = useRouter();

  useEffect(() => {
    // TODO: Check Supabase auth session
    // If authenticated → router.replace('/(tabs)/home')
    // If not → router.replace('/(auth)/welcome')
    
    const timeout = setTimeout(() => {
      router.replace('/(auth)/welcome');
    }, 1500);

    return () => clearTimeout(timeout);
  }, []);

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
