import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { semantic, textStyles, spacing, radius, colors } from '@/theme';
import { Button } from '@/components/ui';
import { useDraftStore } from '@/stores/draftStore';
import { usePublishCapsule } from '@/hooks/useCapsules';
import { useChildren } from '@/hooks/useChildren';
import { DRAFT_AUTOSAVE_INTERVAL } from '@/lib/constants';
import type { Capsule, Child } from '@shared/types';

type Step = 'write' | 'publishing' | 'published';

export default function WriteScreen() {
  const router = useRouter();
  const { children: childrenQuery } = useChildren();
  const publishMutation = usePublishCapsule();

  const draftText = useDraftStore((s) => s.rawText);
  const draftChildId = useDraftStore((s) => s.childId);
  const setText = useDraftStore((s) => s.setText);
  const setChildId = useDraftStore((s) => s.setChildId);
  const clearDraft = useDraftStore((s) => s.clearDraft);
  const markSaved = useDraftStore((s) => s.markSaved);

  const [text, setLocalText] = useState(draftText);
  const [childId, setLocalChildId] = useState<string | null>(draftChildId);
  const [showChildPicker, setShowChildPicker] = useState(false);
  const [step, setStep] = useState<Step>('write');
  const [published, setPublished] = useState<Capsule | null>(null);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Restore draft on mount
  useEffect(() => {
    if (draftText) {
      setLocalText(draftText);
      setLocalChildId(draftChildId);
    }
  }, []);

  // Auto-save with debounce
  const debounceSave = useCallback(
    (value: string) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        setText(value);
        markSaved();
      }, DRAFT_AUTOSAVE_INTERVAL);
    },
    [setText, markSaved],
  );

  function handleTextChange(value: string) {
    setLocalText(value);
    debounceSave(value);
  }

  function handleChildSelect(id: string | null) {
    setLocalChildId(id);
    setChildId(id);
    setShowChildPicker(false);
  }

  async function handlePublish() {
    if (!text.trim()) return;

    setStep('publishing');
    publishMutation.mutate(
      { rawText: text.trim(), childId: childId },
      {
        onSuccess: (capsule) => {
          clearDraft();
          setPublished(capsule);
          setStep('published');
        },
        onError: () => {
          setStep('write');
        },
      },
    );
  }

  function handleWriteAnother() {
    setLocalText('');
    setLocalChildId(null);
    setPublished(null);
    setStep('write');
  }

  const children = childrenQuery.data ?? [];
  const selectedChild = children.find((c) => c.id === childId);

  // ─── Publishing Step ─────────────────────────────────
  if (step === 'publishing') {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={semantic.primary} />
        <Text style={styles.publishingTitle}>Publishing your story...</Text>
        <Text style={styles.publishingSubtitle}>
          Polishing your words and generating metadata
        </Text>
      </SafeAreaView>
    );
  }

  // ─── Published Step ──────────────────────────────────
  if (step === 'published' && published) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.successEmoji}>✨</Text>
        <Text style={styles.successTitle}>Story published!</Text>
        {published.title && (
          <Text style={styles.successCapsuleTitle}>{published.title}</Text>
        )}
        <View style={styles.successActions}>
          <Button
            label="View Story"
            onPress={() => router.push(`/capsule/${published.id}`)}
          />
          <Button
            label="Write Another"
            onPress={handleWriteAnother}
            variant="secondary"
          />
        </View>
      </SafeAreaView>
    );
  }

  // ─── Write Step ──────────────────────────────────────
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>Write a story</Text>
          <Text style={styles.subtitle}>
            Share a memory, a lesson, or a message of love
          </Text>

          {children.length > 0 && (
            <View style={styles.childSelector}>
              <Pressable
                style={styles.childButton}
                onPress={() => setShowChildPicker(!showChildPicker)}
              >
                <Text style={styles.childButtonText}>
                  For:{' '}
                  {selectedChild ? selectedChild.name : 'All children'}
                </Text>
              </Pressable>

              {showChildPicker && (
                <View style={styles.childDropdown}>
                  <Pressable
                    style={styles.childOption}
                    onPress={() => handleChildSelect(null)}
                  >
                    <Text style={styles.childOptionText}>All children</Text>
                  </Pressable>
                  {children.map((child: Child) => (
                    <Pressable
                      key={child.id}
                      style={styles.childOption}
                      onPress={() => handleChildSelect(child.id)}
                    >
                      <Text style={styles.childOptionText}>{child.name}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          )}

          <View style={styles.textArea}>
            <TextInput
              style={styles.textInput}
              value={text}
              onChangeText={handleTextChange}
              placeholder="Start writing... Tell them about a memory, a recipe, a prayer, advice for life..."
              placeholderTextColor={semantic.textMuted}
              multiline
              textAlignVertical="top"
              autoFocus={!draftText}
            />
          </View>

          {text.trim().length > 0 && (
            <Text style={styles.charCount}>
              {text.trim().split(/\s+/).length} words
            </Text>
          )}

          {publishMutation.error && (
            <Text style={styles.error}>
              {publishMutation.error instanceof Error
                ? publishMutation.error.message
                : 'Something went wrong. Your draft is saved — try again.'}
            </Text>
          )}

          <Button
            label="Publish"
            onPress={handlePublish}
            disabled={text.trim().length === 0}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    backgroundColor: semantic.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: semantic.background,
    paddingHorizontal: spacing[6],
  },
  content: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[10],
  },
  title: {
    ...textStyles.h1,
    color: semantic.textPrimary,
    marginBottom: spacing[2],
  },
  subtitle: {
    ...textStyles.body,
    color: semantic.textSecondary,
    marginBottom: spacing[6],
  },
  childSelector: {
    marginBottom: spacing[4],
  },
  childButton: {
    backgroundColor: semantic.surface,
    borderWidth: 1,
    borderColor: semantic.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  childButtonText: {
    ...textStyles.body,
    color: semantic.textPrimary,
  },
  childDropdown: {
    backgroundColor: semantic.surface,
    borderWidth: 1,
    borderColor: semantic.border,
    borderRadius: radius.md,
    marginTop: spacing[2],
    overflow: 'hidden',
  },
  childOption: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: semantic.borderLight,
  },
  childOptionText: {
    ...textStyles.body,
    color: semantic.textPrimary,
  },
  textArea: {
    backgroundColor: semantic.surface,
    borderWidth: 1,
    borderColor: semantic.border,
    borderRadius: radius.lg,
    padding: spacing[5],
    marginBottom: spacing[3],
    minHeight: 240,
  },
  textInput: {
    ...textStyles.bodyLarge,
    color: semantic.textPrimary,
    minHeight: 200,
  },
  charCount: {
    ...textStyles.caption,
    color: semantic.textMuted,
    textAlign: 'right',
    marginBottom: spacing[4],
  },
  error: {
    ...textStyles.bodySmall,
    color: colors.error,
    textAlign: 'center',
    marginBottom: spacing[4],
  },
  // Publishing state
  publishingTitle: {
    ...textStyles.h2,
    color: semantic.textPrimary,
    marginTop: spacing[6],
    textAlign: 'center',
  },
  publishingSubtitle: {
    ...textStyles.body,
    color: semantic.textSecondary,
    marginTop: spacing[2],
    textAlign: 'center',
  },
  // Published state
  successEmoji: {
    fontSize: 48,
    marginBottom: spacing[4],
  },
  successTitle: {
    ...textStyles.h1,
    color: semantic.textPrimary,
    marginBottom: spacing[3],
  },
  successCapsuleTitle: {
    ...textStyles.h3,
    color: semantic.textSecondary,
    marginBottom: spacing[8],
    textAlign: 'center',
  },
  successActions: {
    width: '100%',
    gap: spacing[4],
  },
});
