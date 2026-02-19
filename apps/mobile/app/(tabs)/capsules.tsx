import { View, Text, StyleSheet } from 'react-native';
import { semantic, textStyles, spacing } from '@/theme';

/**
 * Capsules screen — TODO: Implement
 * See CLAUDE.md for full screen description and requirements.
 */
export default function CapsulesScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Capsules</Text>
      <Text style={styles.subtitle}>Coming soon</Text>
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
  title: { ...textStyles.h1, color: semantic.textPrimary, marginBottom: spacing[2] },
  subtitle: { ...textStyles.body, color: semantic.textMuted },
});
