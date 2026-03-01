import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import type { Profile } from '@shared/types';
import { supabase } from '@/lib/supabase';
import { debug } from '@/lib/debug';

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  setSession: (session: Session | null) => void;
  setProfile: (profile: Profile | null) => void;
  setLoading: (loading: boolean) => void;
  signOut: () => Promise<void>;
  reset: () => void;
}

const initialState = {
  session: null,
  user: null,
  profile: null,
  isLoading: true,
  isAuthenticated: false,
};

export const useAuthStore = create<AuthState>((set) => ({
  ...initialState,

  setSession: (session) => {
    debug.log('authStore', 'setSession — authenticated:', session !== null, 'userId:', session?.user?.id);
    set({
      session,
      user: session?.user ?? null,
      isAuthenticated: session !== null,
    });
  },

  setProfile: (profile) => {
    debug.log('authStore', 'setProfile — id:', profile?.id, 'familyId:', profile?.family_id, 'role:', profile?.role);
    set({ profile });
  },

  setLoading: (isLoading) => {
    debug.log('authStore', 'setLoading:', isLoading);
    set({ isLoading });
  },

  signOut: async () => {
    debug.log('authStore', 'signOut — clearing state');
    await supabase.auth.signOut();
    set(initialState);
    set({ isLoading: false });
  },

  reset: () => {
    debug.log('authStore', 'reset');
    set({ ...initialState, isLoading: false });
  },
}));
