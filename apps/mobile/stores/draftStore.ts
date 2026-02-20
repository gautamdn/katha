import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface DraftState {
  rawText: string;
  childId: string | null;
  capsuleId: string | null;
  lastSavedAt: number | null;

  setText: (text: string) => void;
  setChildId: (childId: string | null) => void;
  setCapsuleId: (capsuleId: string | null) => void;
  markSaved: () => void;
  clearDraft: () => void;
}

export const useDraftStore = create<DraftState>()(
  persist(
    (set) => ({
      rawText: '',
      childId: null,
      capsuleId: null,
      lastSavedAt: null,

      setText: (rawText) => set({ rawText }),
      setChildId: (childId) => set({ childId }),
      setCapsuleId: (capsuleId) => set({ capsuleId }),
      markSaved: () => set({ lastSavedAt: Date.now() }),
      clearDraft: () =>
        set({ rawText: '', childId: null, capsuleId: null, lastSavedAt: null }),
    }),
    {
      name: 'katha-draft',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
