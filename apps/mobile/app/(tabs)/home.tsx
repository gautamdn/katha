import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { semantic, textStyles, spacing } from '@/theme';

/**
 * Home screen — family feed.
 * 
 * For Writers: Shows AI prompt of the day + their recent capsules
 * For Guardians: Shows latest capsules across all writers
 * For Readers: Shows unlocked capsules, with locked ones as sealed envelopes
 * 
 * TODO:
 * - Fetch capsules from Supabase
 * - CapsuleCard component with 4 rotating styles
 * - AI prompt of the day banner
 * - Pull-to-refresh
 * - Empty state for new families
 */
export default function Home() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Good morning</Text>
        <Text style={styles.title}>Family Stories</Text>
      </View>

      <View style={styles.promptCard}>
        <Text style={styles.promptLabel}>Today's prompt</Text>
        <Text style={styles.promptText}>
          Tell us about your favorite festival memory growing up...
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Stories</Text>
        <Text style={styles.placeholder}>Capsule feed will appear here</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: semantic.background },
  content: { paddingHorizontal: spacing[5], paddingTop: spacing[16], paddingBottom: spacing[10] },
  header: { marginBottom: spacing[8] },
  greeting: { ...textStyles.bodySmall, color: semantic.textSecondary },
  title: { ...textStyles.h1, color: semantic.textPrimary },
  promptCard: {
    backgroundColor: semantic.primaryLight,
    padding: spacing[5],
    borderRadius: 16,
    marginBottom: spacing[8],
  },
  promptLabel: { ...textStyles.label, color: semantic.primaryDark, marginBottom: spacing[2] },
  promptText: { ...textStyles.quote, color: semantic.textPrimary },
  section: { marginBottom: spacing[6] },
  sectionTitle: { ...textStyles.h3, color: semantic.textPrimary, marginBottom: spacing[4] },
  placeholder: { ...textStyles.body, color: semantic.textMuted },
});
