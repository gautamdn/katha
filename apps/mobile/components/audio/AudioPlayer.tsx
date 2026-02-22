import { View, Text, Pressable, StyleSheet } from 'react-native';
import { semantic, colors, textStyles, spacing, radius, shadow } from '@/theme';
import { useAudioPlayer } from '@/hooks/useAudioPlayer';

interface AudioPlayerProps {
  audioUrl: string;
  durationSeconds?: number;
  writerName?: string;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function AudioPlayer({
  audioUrl,
  durationSeconds: durationProp,
  writerName,
}: AudioPlayerProps) {
  const player = useAudioPlayer(audioUrl);
  const duration = player.durationSeconds || durationProp || 0;

  return (
    <View style={styles.container}>
      {writerName && (
        <Text style={styles.writerLabel}>Listen to {writerName}</Text>
      )}

      {/* Play/Pause + Skip controls */}
      <View style={styles.controls}>
        <Pressable style={styles.skipButton} onPress={() => player.skipBackward()}>
          <Text style={styles.skipText}>-15</Text>
        </Pressable>

        <Pressable
          style={styles.playButton}
          onPress={player.isPlaying ? player.pause : player.play}
          disabled={!player.isLoaded}
        >
          <Text style={styles.playIcon}>
            {player.isPlaying ? '❚❚' : '▶'}
          </Text>
        </Pressable>

        <Pressable style={styles.skipButton} onPress={() => player.skipForward()}>
          <Text style={styles.skipText}>+15</Text>
        </Pressable>
      </View>

      {/* Progress bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressTrack}>
          <View
            style={[styles.progressFill, { width: `${player.progress * 100}%` }]}
          />
        </View>
        <View style={styles.timeLabels}>
          <Text style={styles.timeText}>
            {formatTime(player.positionSeconds)}
          </Text>
          <Text style={styles.timeText}>{formatTime(duration)}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: semantic.surface,
    borderRadius: radius.xl,
    padding: spacing[6],
    ...shadow.md,
  },
  writerLabel: {
    ...textStyles.label,
    color: semantic.textSecondary,
    textAlign: 'center',
    marginBottom: spacing[4],
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[8],
    marginBottom: spacing[6],
  },
  playButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.terracotta[400],
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIcon: {
    fontSize: 24,
    color: colors.white,
  },
  skipButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: semantic.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  skipText: {
    ...textStyles.caption,
    color: semantic.textSecondary,
    fontWeight: '600',
  },
  progressContainer: {
    width: '100%',
  },
  progressTrack: {
    height: 4,
    backgroundColor: semantic.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.terracotta[400],
    borderRadius: 2,
  },
  timeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing[2],
  },
  timeText: {
    ...textStyles.caption,
    color: semantic.textMuted,
  },
});
