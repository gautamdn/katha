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
import { AudioRecorder } from '@/components/audio/AudioRecorder';
import { TimeCapsulePicker } from '@/components/capsule/TimeCapsulePicker';
import { useDraftStore } from '@/stores/draftStore';
import { usePublishCapsule } from '@/hooks/useCapsules';
import { useChildren } from '@/hooks/useChildren';
import { DRAFT_AUTOSAVE_INTERVAL } from '@/lib/constants';
import type { Capsule, Child } from '@shared/types';

type InputMode = 'write' | 'record';
type Step = 'input' | 'preview' | 'publishing' | 'published';

export default function RecordScreen() {
  const router = useRouter();
  const { children: childrenQuery } = useChildren();
  const publishMutation = usePublishCapsule();

  // Draft store
  const draftText = useDraftStore((s) => s.rawText);
  const draftChildId = useDraftStore((s) => s.childId);
  const draftAudioUri = useDraftStore((s) => s.audioUri);
  const draftAudioDuration = useDraftStore((s) => s.audioDurationSeconds);
  const setText = useDraftStore((s) => s.setText);
  const setChildId = useDraftStore((s) => s.setChildId);
  const setAudioUri = useDraftStore((s) => s.setAudioUri);
  const setAudioDuration = useDraftStore((s) => s.setAudioDuration);
  const clearDraft = useDraftStore((s) => s.clearDraft);
  const markSaved = useDraftStore((s) => s.markSaved);
  const unlockType = useDraftStore((s) => s.unlockType);
  const unlockDate = useDraftStore((s) => s.unlockDate);
  const unlockAge = useDraftStore((s) => s.unlockAge);
  const unlockMilestone = useDraftStore((s) => s.unlockMilestone);
  const isSurprise = useDraftStore((s) => s.isSurprise);

  // Local state
  const [mode, setMode] = useState<InputMode>('write');
  const [text, setLocalText] = useState(draftText);
  const [childId, setLocalChildId] = useState<string | null>(draftChildId);
  const [showChildPicker, setShowChildPicker] = useState(false);
  const [step, setStep] = useState<Step>('input');
  const [published, setPublished] = useState<Capsule | null>(null);

  // Audio preview state
  const [audioUri, setLocalAudioUri] = useState<string | null>(draftAudioUri);
  const [audioDuration, setLocalAudioDuration] = useState<number | null>(draftAudioDuration);
  const [noteText, setNoteText] = useState('');

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Restore draft on mount
  useEffect(() => {
    if (draftText) {
      setLocalText(draftText);
      setLocalChildId(draftChildId);
    }
  }, []);

  // Auto-save with debounce (write mode)
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

  function handleRecordingComplete(uri: string, duration: number) {
    setLocalAudioUri(uri);
    setLocalAudioDuration(duration);
    setAudioUri(uri);
    setAudioDuration(duration);
    setStep('preview');
  }

  function handleRecordingDiscard() {
    setLocalAudioUri(null);
    setLocalAudioDuration(null);
    setAudioUri(null);
    setAudioDuration(null);
  }

  function handleReRecord() {
    setLocalAudioUri(null);
    setLocalAudioDuration(null);
    setAudioUri(null);
    setAudioDuration(null);
    setNoteText('');
    setStep('input');
  }

  async function handlePublish() {
    const rawText = mode === 'write' ? text.trim() : noteText.trim();
    if (mode === 'write' && !rawText) return;
    if (mode === 'record' && !audioUri) return;

    setStep('publishing');
    publishMutation.mutate(
      {
        rawText: rawText || '',
        childId: childId,
        audioUri: mode === 'record' ? audioUri : undefined,
        audioDurationSeconds: mode === 'record' ? audioDuration : undefined,
        unlockType,
        unlockDate,
        unlockAge,
        unlockMilestone,
        isSurprise,
      },
      {
        onSuccess: (capsule) => {
          clearDraft();
          setPublished(capsule);
          setStep('published');
        },
        onError: () => {
          setStep(mode === 'record' ? 'preview' : 'input');
        },
      },
    );
  }

  function handleWriteAnother() {
    setLocalText('');
    setLocalChildId(null);
    setLocalAudioUri(null);
    setLocalAudioDuration(null);
    setNoteText('');
    setPublished(null);
    setStep('input');
  }

  const children = childrenQuery.data ?? [];
  const selectedChild = children.find((c) => c.id === childId);

  // ─── Publishing Step ────────────────────────────────
  if (step === 'publishing') {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={semantic.primary} />
        <Text style={styles.publishingTitle}>
          Publishing your {mode === 'record' ? 'recording' : 'story'}...
        </Text>
        <Text style={styles.publishingSubtitle}>
          {mode === 'record'
            ? 'Transcribing audio, polishing text, and generating metadata'
            : 'Polishing your words and generating metadata'}
        </Text>
      </SafeAreaView>
    );
  }

  // ─── Published Step ─────────────────────────────────
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

  // ─── Audio Preview Step (record mode) ───────────────
  if (step === 'preview' && mode === 'record' && audioUri) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>Review recording</Text>

          {/* Audio preview card */}
          <View style={styles.audioPreviewCard}>
            <Text style={styles.audioPreviewIcon}>🎙️</Text>
            <Text style={styles.audioPreviewDuration}>
              {formatDuration(audioDuration ?? 0)}
            </Text>
            <Pressable onPress={handleReRecord}>
              <Text style={styles.reRecordText}>Re-record</Text>
            </Pressable>
          </View>

          {/* Optional note */}
          <Text style={styles.sectionLabel}>Add a note (optional)</Text>
          <View style={styles.noteArea}>
            <TextInput
              style={styles.noteInput}
              value={noteText}
              onChangeText={setNoteText}
              placeholder="Add a short note about this recording..."
              placeholderTextColor={semantic.textMuted}
              multiline
              textAlignVertical="top"
            />
          </View>

          {/* Child picker */}
          {children.length > 0 && (
            <ChildPicker
              children={children}
              selectedChild={selectedChild ?? null}
              showPicker={showChildPicker}
              onToggle={() => setShowChildPicker(!showChildPicker)}
              onSelect={handleChildSelect}
            />
          )}

          <TimeCapsulePicker />

          {publishMutation.error && (
            <Text style={styles.error}>
              {publishMutation.error instanceof Error
                ? publishMutation.error.message
                : 'Something went wrong. Try again.'}
            </Text>
          )}

          <Button label="Publish" onPress={handlePublish} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── Input Step ─────────────────────────────────────
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
          {/* Mode toggle */}
          <View style={styles.modeToggle}>
            <Pressable
              style={[styles.modeTab, mode === 'write' && styles.modeTabActive]}
              onPress={() => setMode('write')}
            >
              <Text
                style={[
                  styles.modeTabText,
                  mode === 'write' && styles.modeTabTextActive,
                ]}
              >
                Write
              </Text>
            </Pressable>
            <Pressable
              style={[styles.modeTab, mode === 'record' && styles.modeTabActive]}
              onPress={() => setMode('record')}
            >
              <Text
                style={[
                  styles.modeTabText,
                  mode === 'record' && styles.modeTabTextActive,
                ]}
              >
                Record
              </Text>
            </Pressable>
          </View>

          <Text style={styles.title}>
            {mode === 'write' ? 'Write a story' : 'Record a story'}
          </Text>
          <Text style={styles.subtitle}>
            {mode === 'write'
              ? 'Share a memory, a lesson, or a message of love'
              : 'Speak your story — we\'ll transcribe and preserve it'}
          </Text>

          {/* Write mode */}
          {mode === 'write' && (
            <>
              {children.length > 0 && (
                <ChildPicker
                  children={children}
                  selectedChild={selectedChild ?? null}
                  showPicker={showChildPicker}
                  onToggle={() => setShowChildPicker(!showChildPicker)}
                  onSelect={handleChildSelect}
                />
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

              <TimeCapsulePicker />

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
            </>
          )}

          {/* Record mode */}
          {mode === 'record' && (
            <AudioRecorder
              onRecordingComplete={handleRecordingComplete}
              onDiscard={handleRecordingDiscard}
            />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Child Picker (shared between modes) ──────────────

function ChildPicker({
  children,
  selectedChild,
  showPicker,
  onToggle,
  onSelect,
}: {
  children: Child[];
  selectedChild: Child | null;
  showPicker: boolean;
  onToggle: () => void;
  onSelect: (id: string | null) => void;
}) {
  return (
    <View style={styles.childSelector}>
      <Pressable style={styles.childButton} onPress={onToggle}>
        <Text style={styles.childButtonText}>
          For: {selectedChild ? selectedChild.name : 'All children'}
        </Text>
      </Pressable>

      {showPicker && (
        <View style={styles.childDropdown}>
          <Pressable
            style={styles.childOption}
            onPress={() => onSelect(null)}
          >
            <Text style={styles.childOptionText}>All children</Text>
          </Pressable>
          {children.map((child) => (
            <Pressable
              key={child.id}
              style={styles.childOption}
              onPress={() => onSelect(child.id)}
            >
              <Text style={styles.childOptionText}>{child.name}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
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

  // Mode toggle
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: semantic.surfaceAlt,
    borderRadius: radius.lg,
    padding: spacing[1],
    marginBottom: spacing[6],
  },
  modeTab: {
    flex: 1,
    paddingVertical: spacing[3],
    borderRadius: radius.md,
    alignItems: 'center',
  },
  modeTabActive: {
    backgroundColor: semantic.surface,
  },
  modeTabText: {
    ...textStyles.label,
    color: semantic.textMuted,
  },
  modeTabTextActive: {
    color: semantic.textPrimary,
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

  // Child selector
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

  // Text writing
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

  // Audio preview
  audioPreviewCard: {
    backgroundColor: semantic.surface,
    borderWidth: 1,
    borderColor: semantic.border,
    borderRadius: radius.lg,
    padding: spacing[6],
    alignItems: 'center',
    marginBottom: spacing[6],
  },
  audioPreviewIcon: {
    fontSize: 32,
    marginBottom: spacing[2],
  },
  audioPreviewDuration: {
    ...textStyles.h2,
    color: semantic.textPrimary,
    marginBottom: spacing[3],
  },
  reRecordText: {
    ...textStyles.bodySmall,
    color: colors.terracotta[500],
    textDecorationLine: 'underline',
  },
  sectionLabel: {
    ...textStyles.label,
    color: semantic.textSecondary,
    marginBottom: spacing[2],
  },
  noteArea: {
    backgroundColor: semantic.surface,
    borderWidth: 1,
    borderColor: semantic.border,
    borderRadius: radius.lg,
    padding: spacing[4],
    marginBottom: spacing[4],
    minHeight: 100,
  },
  noteInput: {
    ...textStyles.body,
    color: semantic.textPrimary,
    minHeight: 80,
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
