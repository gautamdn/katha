import { useCallback, useEffect, useRef, useState } from 'react';
import { Audio } from 'expo-av';

interface UseAudioPlayerReturn {
  isPlaying: boolean;
  isLoaded: boolean;
  positionSeconds: number;
  durationSeconds: number;
  progress: number; // 0 to 1
  play: () => Promise<void>;
  pause: () => Promise<void>;
  seekTo: (seconds: number) => Promise<void>;
  skipForward: (seconds?: number) => Promise<void>;
  skipBackward: (seconds?: number) => Promise<void>;
}

export function useAudioPlayer(audioUrl: string | null): UseAudioPlayerReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [positionSeconds, setPositionSeconds] = useState(0);
  const [durationSeconds, setDurationSeconds] = useState(0);

  const soundRef = useRef<Audio.Sound | null>(null);

  // Load sound when URL changes
  useEffect(() => {
    if (!audioUrl) return;

    let mounted = true;

    async function loadSound() {
      // Ensure audio mode allows playback
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      const { sound, status } = await Audio.Sound.createAsync(
        { uri: audioUrl! },
        { shouldPlay: false },
        onPlaybackStatusUpdate,
      );

      if (!mounted) {
        await sound.unloadAsync();
        return;
      }

      soundRef.current = sound;

      if (status.isLoaded) {
        setDurationSeconds((status.durationMillis ?? 0) / 1000);
        setIsLoaded(true);
      }
    }

    loadSound().catch(console.warn);

    return () => {
      mounted = false;
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
      setIsLoaded(false);
      setIsPlaying(false);
      setPositionSeconds(0);
    };
  }, [audioUrl]);

  function onPlaybackStatusUpdate(status: any) {
    if (!status.isLoaded) return;

    setPositionSeconds((status.positionMillis ?? 0) / 1000);
    setDurationSeconds((status.durationMillis ?? 0) / 1000);
    setIsPlaying(status.isPlaying);

    // Reset when playback finishes
    if (status.didJustFinish) {
      setIsPlaying(false);
      setPositionSeconds(0);
    }
  }

  const play = useCallback(async () => {
    if (!soundRef.current) return;
    const status = await soundRef.current.getStatusAsync();
    if (status.isLoaded && status.didJustFinish) {
      await soundRef.current.setPositionAsync(0);
    }
    await soundRef.current.playAsync();
  }, []);

  const pause = useCallback(async () => {
    if (!soundRef.current) return;
    await soundRef.current.pauseAsync();
  }, []);

  const seekTo = useCallback(async (seconds: number) => {
    if (!soundRef.current) return;
    await soundRef.current.setPositionAsync(seconds * 1000);
  }, []);

  const skipForward = useCallback(
    async (seconds = 15) => {
      if (!soundRef.current) return;
      const newPos = Math.min(positionSeconds + seconds, durationSeconds);
      await soundRef.current.setPositionAsync(newPos * 1000);
    },
    [positionSeconds, durationSeconds],
  );

  const skipBackward = useCallback(
    async (seconds = 15) => {
      if (!soundRef.current) return;
      const newPos = Math.max(positionSeconds - seconds, 0);
      await soundRef.current.setPositionAsync(newPos * 1000);
    },
    [positionSeconds],
  );

  const progress =
    durationSeconds > 0 ? positionSeconds / durationSeconds : 0;

  return {
    isPlaying,
    isLoaded,
    positionSeconds,
    durationSeconds,
    progress,
    play,
    pause,
    seekTo,
    skipForward,
    skipBackward,
  };
}
