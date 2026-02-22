import { View, Text, Pressable, StyleSheet } from 'react-native';
import { semantic, colors, textStyles, spacing, radius } from '@/theme';
import { useAudioRecorder, RecorderState } from '@/hooks/useAudioRecorder';
import { MAX_AUDIO_DURATION_SECONDS } from '@/lib/constants';

interface AudioRecorderProps {
  onRecordingComplete: (uri: string, durationSeconds: number) => void;
  onDiscard: () => void;
}

export function AudioRecorder({
  onRecordingComplete,
  onDiscard,
}: AudioRecorderProps) {
  const recorder = useAudioRecorder();

  async function handleStop() {
    const uri = await recorder.stop();
    if (uri) {
      onRecordingComplete(uri, recorder.durationSeconds);
    }
  }

  async function handleDiscard() {
    await recorder.discard();
    onDiscard();
  }

  return (
    <View style={styles.container}>
      {/* Timer */}
      <Text style={styles.timer}>{recorder.durationFormatted}</Text>
      <Text style={styles.maxDuration}>
        {Math.floor(MAX_AUDIO_DURATION_SECONDS / 60)} min max
      </Text>

      {/* Metering bars */}
      {(recorder.state === 'recording' || recorder.state === 'paused') && (
        <MeteringBars metering={recorder.metering} active={recorder.state === 'recording'} />
      )}

      {/* Record button */}
      {recorder.state === 'idle' && (
        <Pressable style={styles.recordButton} onPress={recorder.start}>
          <View style={styles.recordDot} />
        </Pressable>
      )}

      {/* Recording controls */}
      {recorder.state === 'recording' && (
        <View style={styles.controls}>
          <Pressable style={styles.controlButton} onPress={handleDiscard}>
            <Text style={styles.controlIcon}>✕</Text>
            <Text style={styles.controlLabel}>Discard</Text>
          </Pressable>

          <Pressable style={styles.pauseButton} onPress={recorder.pause}>
            <Text style={styles.pauseIcon}>❚❚</Text>
          </Pressable>

          <Pressable style={styles.controlButton} onPress={handleStop}>
            <Text style={styles.controlIcon}>■</Text>
            <Text style={styles.controlLabel}>Done</Text>
          </Pressable>
        </View>
      )}

      {/* Paused controls */}
      {recorder.state === 'paused' && (
        <View style={styles.controls}>
          <Pressable style={styles.controlButton} onPress={handleDiscard}>
            <Text style={styles.controlIcon}>✕</Text>
            <Text style={styles.controlLabel}>Discard</Text>
          </Pressable>

          <Pressable style={styles.recordButton} onPress={recorder.resume}>
            <View style={styles.recordDot} />
          </Pressable>

          <Pressable style={styles.controlButton} onPress={handleStop}>
            <Text style={styles.controlIcon}>■</Text>
            <Text style={styles.controlLabel}>Done</Text>
          </Pressable>
        </View>
      )}

      {/* Idle hint */}
      {recorder.state === 'idle' && (
        <Text style={styles.hint}>Tap to start recording</Text>
      )}
      {recorder.state === 'recording' && (
        <Text style={[styles.hint, styles.recordingHint]}>Recording...</Text>
      )}
      {recorder.state === 'paused' && (
        <Text style={styles.hint}>Paused — tap to resume</Text>
      )}
    </View>
  );
}

/** Simple metering visualization — 5 bars */
function MeteringBars({ metering, active }: { metering: number; active: boolean }) {
  // Normalize metering from dB (-160..0) to 0..1
  const normalized = Math.max(0, Math.min(1, (metering + 60) / 60));
  const barCount = 5;

  return (
    <View style={styles.meteringContainer}>
      {Array.from({ length: barCount }, (_, i) => {
        const threshold = (i + 1) / barCount;
        const isActive = active && normalized >= threshold;
        const height = 12 + (i + 1) * 8;
        return (
          <View
            key={i}
            style={[
              styles.meteringBar,
              { height },
              isActive ? styles.meteringBarActive : styles.meteringBarInactive,
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: spacing[8],
  },
  timer: {
    ...textStyles.displayMedium,
    color: semantic.textPrimary,
    marginBottom: spacing[1],
  },
  maxDuration: {
    ...textStyles.caption,
    color: semantic.textMuted,
    marginBottom: spacing[8],
  },
  meteringContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    height: 52,
    marginBottom: spacing[6],
  },
  meteringBar: {
    width: 6,
    borderRadius: 3,
  },
  meteringBarActive: {
    backgroundColor: colors.terracotta[400],
  },
  meteringBarInactive: {
    backgroundColor: semantic.border,
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.terracotta[400],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  recordDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.white,
  },
  pauseButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.terracotta[400],
    justifyContent: 'center',
    alignItems: 'center',
  },
  pauseIcon: {
    fontSize: 20,
    color: colors.white,
    letterSpacing: 2,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
    marginBottom: spacing[4],
  },
  controlButton: {
    alignItems: 'center',
    minWidth: 60,
  },
  controlIcon: {
    fontSize: 20,
    color: semantic.textSecondary,
    marginBottom: spacing[1],
  },
  controlLabel: {
    ...textStyles.caption,
    color: semantic.textSecondary,
  },
  hint: {
    ...textStyles.body,
    color: semantic.textMuted,
    marginTop: spacing[4],
  },
  recordingHint: {
    color: colors.terracotta[500],
  },
});
