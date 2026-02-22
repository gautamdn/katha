import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { UnlockType } from '@shared/types';

interface DraftState {
  rawText: string;
  childId: string | null;
  capsuleId: string | null;
  lastSavedAt: number | null;

  // Audio
  audioUri: string | null;
  audioDurationSeconds: number | null;

  // Time capsule
  unlockType: UnlockType;
  unlockDate: string | null;
  unlockAge: number | null;
  unlockMilestone: string | null;
  isSurprise: boolean;

  setText: (text: string) => void;
  setChildId: (childId: string | null) => void;
  setCapsuleId: (capsuleId: string | null) => void;
  markSaved: () => void;

  setAudioUri: (uri: string | null) => void;
  setAudioDuration: (seconds: number | null) => void;

  setUnlockType: (type: UnlockType) => void;
  setUnlockDate: (date: string | null) => void;
  setUnlockAge: (age: number | null) => void;
  setUnlockMilestone: (milestone: string | null) => void;
  setIsSurprise: (isSurprise: boolean) => void;

  clearDraft: () => void;
}

const initialDraft = {
  rawText: '',
  childId: null,
  capsuleId: null,
  lastSavedAt: null,
  audioUri: null,
  audioDurationSeconds: null,
  unlockType: 'immediate' as UnlockType,
  unlockDate: null,
  unlockAge: null,
  unlockMilestone: null,
  isSurprise: false,
};

export const useDraftStore = create<DraftState>()(
  persist(
    (set) => ({
      ...initialDraft,

      setText: (rawText) => set({ rawText }),
      setChildId: (childId) => set({ childId }),
      setCapsuleId: (capsuleId) => set({ capsuleId }),
      markSaved: () => set({ lastSavedAt: Date.now() }),

      setAudioUri: (audioUri) => set({ audioUri }),
      setAudioDuration: (audioDurationSeconds) => set({ audioDurationSeconds }),

      setUnlockType: (unlockType) => set({ unlockType }),
      setUnlockDate: (unlockDate) => set({ unlockDate }),
      setUnlockAge: (unlockAge) => set({ unlockAge }),
      setUnlockMilestone: (unlockMilestone) => set({ unlockMilestone }),
      setIsSurprise: (isSurprise) => set({ isSurprise }),

      clearDraft: () => set(initialDraft),
    }),
    {
      name: 'katha-draft',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
