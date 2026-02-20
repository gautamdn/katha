import { useAuthStore } from '@/stores/authStore';
import * as api from '@/lib/api';
import { signUpSchema } from '@shared/schema';

function friendlyError(error: unknown): string {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('invalid login credentials'))
      return 'Incorrect email or password.';
    if (msg.includes('user already registered'))
      return 'An account with this email already exists.';
    if (msg.includes('network') || msg.includes('fetch'))
      return 'Could not connect. Please check your internet and try again.';
  }
  return 'Something went wrong. Please try again.';
}

export function useAuth() {
  const { session, user, profile, isLoading, isAuthenticated } = useAuthStore();
  const setSession = useAuthStore((s) => s.setSession);
  const setProfile = useAuthStore((s) => s.setProfile);
  const storeSignOut = useAuthStore((s) => s.signOut);

  async function signUp(params: {
    email: string;
    password: string;
    display_name: string;
    role: 'guardian' | 'writer';
  }): Promise<{ error?: string }> {
    try {
      const validation = signUpSchema.safeParse(params);
      if (!validation.success) {
        return { error: validation.error.issues[0].message };
      }

      const { data, error } = await api.signUp(params);
      if (error) {
        console.error('[useAuth.signUp] auth error:', error.message);
        return { error: friendlyError(error) };
      }

      // Session is set automatically by the auth listener in _layout.tsx,
      // but we also set it here for immediate state in the current screen.
      if (data.session) {
        setSession(data.session);
        if (data.session.user) {
          const profile = await api.getProfile(data.session.user.id);
          console.log('[useAuth.signUp] profile fetched:', profile?.id ?? 'null');
          setProfile(profile);
        }
      } else {
        console.warn('[useAuth.signUp] no session returned — email confirmation may be enabled');
      }

      return {};
    } catch (e) {
      console.error('[useAuth.signUp] unexpected error:', e);
      return { error: friendlyError(e) };
    }
  }

  async function signIn(params: {
    email: string;
    password: string;
  }): Promise<{ error?: string }> {
    try {
      const { data, error } = await api.signIn(params);
      if (error) {
        console.error('[useAuth.signIn] auth error:', error.message);
        return { error: friendlyError(error) };
      }

      if (data.session) {
        setSession(data.session);
        if (data.session.user) {
          const profile = await api.getProfile(data.session.user.id);
          console.log('[useAuth.signIn] profile fetched:', profile?.id ?? 'null');
          setProfile(profile);
        }
      }

      return {};
    } catch (e) {
      console.error('[useAuth.signIn] unexpected error:', e);
      return { error: friendlyError(e) };
    }
  }

  async function signOut() {
    await storeSignOut();
  }

  return {
    session,
    user,
    profile,
    isLoading,
    isAuthenticated,
    signUp,
    signIn,
    signOut,
  };
}
