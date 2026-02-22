import { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  StyleSheet,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { semantic, colors, textStyles, spacing, radius } from '@/theme';
import { useDraftStore } from '@/stores/draftStore';
import { MILESTONE_OPTIONS } from '@/lib/constants';
import type { UnlockType } from '@shared/types';

const UNLOCK_OPTIONS: { value: UnlockType; label: string; icon: string }[] = [
  { value: 'immediate', label: 'Immediately', icon: '📬' },
  { value: 'date', label: 'On a date', icon: '📅' },
  { value: 'age', label: 'At an age', icon: '🎂' },
  { value: 'milestone', label: 'At a milestone', icon: '🎯' },
];

export function TimeCapsulePicker() {
  const unlockType = useDraftStore((s) => s.unlockType);
  const unlockDate = useDraftStore((s) => s.unlockDate);
  const unlockAge = useDraftStore((s) => s.unlockAge);
  const unlockMilestone = useDraftStore((s) => s.unlockMilestone);
  const isSurprise = useDraftStore((s) => s.isSurprise);
  const setUnlockType = useDraftStore((s) => s.setUnlockType);
  const setUnlockDate = useDraftStore((s) => s.setUnlockDate);
  const setUnlockAge = useDraftStore((s) => s.setUnlockAge);
  const setUnlockMilestone = useDraftStore((s) => s.setUnlockMilestone);
  const setIsSurprise = useDraftStore((s) => s.setIsSurprise);

  const [expanded, setExpanded] = useState(unlockType !== 'immediate');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [ageText, setAgeText] = useState(unlockAge?.toString() ?? '');

  function handleTypeSelect(type: UnlockType) {
    setUnlockType(type);
    // Clear fields for other types
    if (type !== 'date') setUnlockDate(null);
    if (type !== 'age') {
      setUnlockAge(null);
      setAgeText('');
    }
    if (type !== 'milestone') setUnlockMilestone(null);
  }

  function handleDateChange(_: any, date?: Date) {
    setShowDatePicker(Platform.OS === 'ios');
    if (date) {
      setUnlockDate(date.toISOString());
    }
  }

  function handleAgeChange(text: string) {
    setAgeText(text);
    const num = parseInt(text, 10);
    setUnlockAge(isNaN(num) ? null : num);
  }

  const isTimeCapsule = unlockType !== 'immediate';

  return (
    <View style={styles.container}>
      {/* Toggle header */}
      <Pressable
        style={styles.toggleHeader}
        onPress={() => setExpanded(!expanded)}
      >
        <Text style={styles.toggleIcon}>{isTimeCapsule ? '🔒' : '📬'}</Text>
        <Text style={styles.toggleLabel}>
          {isTimeCapsule ? 'Time capsule' : 'Opens immediately'}
        </Text>
        <Text style={styles.toggleChevron}>{expanded ? '▲' : '▼'}</Text>
      </Pressable>

      {expanded && (
        <View style={styles.body}>
          {/* Unlock type radio options */}
          {UNLOCK_OPTIONS.map((option) => (
            <Pressable
              key={option.value}
              style={[
                styles.radioRow,
                unlockType === option.value && styles.radioRowActive,
              ]}
              onPress={() => handleTypeSelect(option.value)}
            >
              <View
                style={[
                  styles.radioDot,
                  unlockType === option.value && styles.radioDotActive,
                ]}
              />
              <Text style={styles.radioIcon}>{option.icon}</Text>
              <Text
                style={[
                  styles.radioLabel,
                  unlockType === option.value && styles.radioLabelActive,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}

          {/* Date picker */}
          {unlockType === 'date' && (
            <View style={styles.subSection}>
              <Pressable
                style={styles.dateButton}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={styles.dateButtonText}>
                  {unlockDate
                    ? new Date(unlockDate).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })
                    : 'Choose a date...'}
                </Text>
              </Pressable>
              {showDatePicker && (
                <DateTimePicker
                  value={unlockDate ? new Date(unlockDate) : new Date()}
                  mode="date"
                  minimumDate={new Date()}
                  onChange={handleDateChange}
                />
              )}
            </View>
          )}

          {/* Age input */}
          {unlockType === 'age' && (
            <View style={styles.subSection}>
              <Text style={styles.subLabel}>
                Open when the child turns...
              </Text>
              <TextInput
                style={styles.ageInput}
                value={ageText}
                onChangeText={handleAgeChange}
                placeholder="e.g. 18"
                placeholderTextColor={semantic.textMuted}
                keyboardType="number-pad"
                maxLength={3}
              />
            </View>
          )}

          {/* Milestone chips */}
          {unlockType === 'milestone' && (
            <View style={styles.subSection}>
              <Text style={styles.subLabel}>Choose a milestone</Text>
              <View style={styles.chipGrid}>
                {MILESTONE_OPTIONS.map((ms) => (
                  <Pressable
                    key={ms.value}
                    style={[
                      styles.chip,
                      unlockMilestone === ms.value && styles.chipActive,
                    ]}
                    onPress={() => setUnlockMilestone(ms.value)}
                  >
                    <Text style={styles.chipEmoji}>{ms.emoji}</Text>
                    <Text
                      style={[
                        styles.chipLabel,
                        unlockMilestone === ms.value && styles.chipLabelActive,
                      ]}
                      numberOfLines={1}
                    >
                      {ms.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {/* Surprise toggle */}
          {isTimeCapsule && (
            <Pressable
              style={styles.surpriseRow}
              onPress={() => setIsSurprise(!isSurprise)}
            >
              <View
                style={[
                  styles.checkbox,
                  isSurprise && styles.checkboxActive,
                ]}
              >
                {isSurprise && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <View style={styles.surpriseText}>
                <Text style={styles.surpriseLabel}>Make it a surprise</Text>
                <Text style={styles.surpriseHint}>
                  Hidden from the feed until it unlocks
                </Text>
              </View>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: semantic.surface,
    borderWidth: 1,
    borderColor: semantic.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginBottom: spacing[4],
  },
  toggleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[4],
  },
  toggleIcon: {
    fontSize: 18,
    marginRight: spacing[2],
  },
  toggleLabel: {
    ...textStyles.body,
    color: semantic.textPrimary,
    flex: 1,
  },
  toggleChevron: {
    ...textStyles.caption,
    color: semantic.textMuted,
  },
  body: {
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[4],
    borderTopWidth: 1,
    borderTopColor: semantic.borderLight,
    paddingTop: spacing[3],
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3],
    borderRadius: radius.md,
    marginBottom: spacing[1],
  },
  radioRowActive: {
    backgroundColor: semantic.primaryLight,
  },
  radioDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: semantic.border,
    marginRight: spacing[3],
  },
  radioDotActive: {
    borderColor: semantic.primary,
    backgroundColor: semantic.primary,
  },
  radioIcon: {
    fontSize: 16,
    marginRight: spacing[2],
  },
  radioLabel: {
    ...textStyles.body,
    color: semantic.textPrimary,
  },
  radioLabelActive: {
    fontWeight: '600',
  },
  subSection: {
    paddingLeft: spacing[4],
    paddingTop: spacing[3],
    paddingBottom: spacing[2],
  },
  subLabel: {
    ...textStyles.label,
    color: semantic.textSecondary,
    marginBottom: spacing[2],
  },
  dateButton: {
    backgroundColor: semantic.surfaceAlt,
    borderWidth: 1,
    borderColor: semantic.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  dateButtonText: {
    ...textStyles.body,
    color: semantic.textPrimary,
  },
  ageInput: {
    backgroundColor: semantic.surfaceAlt,
    borderWidth: 1,
    borderColor: semantic.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    ...textStyles.bodyLarge,
    color: semantic.textPrimary,
    width: 100,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: semantic.border,
    backgroundColor: semantic.surfaceAlt,
  },
  chipActive: {
    borderColor: semantic.primary,
    backgroundColor: semantic.primaryLight,
  },
  chipEmoji: {
    fontSize: 14,
    marginRight: spacing[1],
  },
  chipLabel: {
    ...textStyles.caption,
    color: semantic.textPrimary,
  },
  chipLabelActive: {
    color: semantic.primaryDark,
    fontWeight: '600',
  },
  surpriseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing[4],
    borderTopWidth: 1,
    borderTopColor: semantic.borderLight,
    marginTop: spacing[3],
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: semantic.border,
    marginRight: spacing[3],
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: {
    borderColor: semantic.primary,
    backgroundColor: semantic.primary,
  },
  checkmark: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  surpriseText: {
    flex: 1,
  },
  surpriseLabel: {
    ...textStyles.body,
    color: semantic.textPrimary,
  },
  surpriseHint: {
    ...textStyles.caption,
    color: semantic.textMuted,
  },
});
