import { useCallback, useEffect, useRef, useState } from 'react';
import { Audio } from 'expo-av';
import { MAX_AUDIO_DURATION_SECONDS } from '../lib/constants';

export type RecorderState = 'idle' | 'recording' | 'paused' | 'stopped';

interface UseAudioRecorderReturn {
  state: RecorderState;
  durationSeconds: number;
  durationFormatted: string;
  uri: string | null;
  metering: number; // dB level, typically -160 to 0
  start: () => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  stop: () => Promise<string | null>; // returns URI
  discard: () => Promise<void>;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [state, setState] = useState<RecorderState>('idle');
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [uri, setUri] = useState<string | null>(null);
  const [metering, setMetering] = useState(-160);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);
  const elapsedBeforePauseRef = useRef(0);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
      }
    };
  }, []);

  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(async () => {
      const elapsed =
        elapsedBeforePauseRef.current +
        (Date.now() - startTimeRef.current) / 1000;
      setDurationSeconds(elapsed);

      // Read metering level
      if (recordingRef.current) {
        try {
          const status = await recordingRef.current.getStatusAsync();
          if (status.isRecording && status.metering !== undefined) {
            setMetering(status.metering);
          }
        } catch {
          // ignore
        }
      }

      // Auto-stop at max duration
      if (elapsed >= MAX_AUDIO_DURATION_SECONDS) {
        if (recordingRef.current) {
          try {
            await recordingRef.current.stopAndUnloadAsync();
            const finalUri = recordingRef.current.getURI();
            setUri(finalUri);
            setState('stopped');
          } catch {
            // ignore
          }
        }
        if (timerRef.current) clearInterval(timerRef.current);
      }
    }, 250);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    elapsedBeforePauseRef.current =
      elapsedBeforePauseRef.current +
      (Date.now() - startTimeRef.current) / 1000;
  }, []);

  const start = useCallback(async () => {
    // Request permissions
    const { granted } = await Audio.requestPermissionsAsync();
    if (!granted) {
      throw new Error('Microphone permission not granted');
    }

    // Configure audio mode for recording
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    // Reset state
    setDurationSeconds(0);
    setUri(null);
    setMetering(-160);
    elapsedBeforePauseRef.current = 0;

    const { recording } = await Audio.Recording.createAsync(
      {
        isMeteringEnabled: true,
        android: {
          extension: '.m4a',
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        ios: {
          extension: '.m4a',
          outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        web: {
          mimeType: 'audio/mp4',
          bitsPerSecond: 128000,
        },
      },
    );

    recordingRef.current = recording;
    setState('recording');
    startTimer();
  }, [startTimer]);

  const pause = useCallback(async () => {
    if (!recordingRef.current || state !== 'recording') return;
    await recordingRef.current.pauseAsync();
    stopTimer();
    setState('paused');
    setMetering(-160);
  }, [state, stopTimer]);

  const resume = useCallback(async () => {
    if (!recordingRef.current || state !== 'paused') return;
    await recordingRef.current.startAsync();
    setState('recording');
    startTimer();
  }, [state, startTimer]);

  const stop = useCallback(async (): Promise<string | null> => {
    if (!recordingRef.current) return null;
    stopTimer();

    try {
      await recordingRef.current.stopAndUnloadAsync();
    } catch {
      // May already be stopped
    }

    // Reset audio mode so playback works
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
    });

    const finalUri = recordingRef.current.getURI();
    recordingRef.current = null;
    setUri(finalUri);
    setState('stopped');
    setMetering(-160);
    return finalUri;
  }, [stopTimer]);

  const discard = useCallback(async () => {
    if (recordingRef.current) {
      stopTimer();
      try {
        await recordingRef.current.stopAndUnloadAsync();
      } catch {
        // ignore
      }
      recordingRef.current = null;
    }

    // Reset audio mode
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
    });

    setUri(null);
    setDurationSeconds(0);
    setMetering(-160);
    setState('idle');
    elapsedBeforePauseRef.current = 0;
  }, [stopTimer]);

  return {
    state,
    durationSeconds,
    durationFormatted: formatDuration(durationSeconds),
    uri,
    metering,
    start,
    pause,
    resume,
    stop,
    discard,
  };
}
