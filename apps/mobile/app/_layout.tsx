import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';
import { semantic } from '@/theme';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { debug } from '@/lib/debug';
import * as api from '@/lib/api';

// Prevent splash screen from hiding until fonts are loaded
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 2,
    },
  },
});

export default function RootLayout() {
  const setSession = useAuthStore((s) => s.setSession);
  const setProfile = useAuthStore((s) => s.setProfile);
  const setLoading = useAuthStore((s) => s.setLoading);

  // Bootstrap auth state from persisted session + listen for changes
  useEffect(() => {
    debug.log('RootLayout', 'bootstrapping auth...');
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      debug.log('RootLayout', 'getSession result — hasSession:', !!session, 'userId:', session?.user?.id);
      setSession(session);
      if (session?.user) {
        try {
          const profile = await api.getProfile(session.user.id);
          debug.log('RootLayout', 'profile loaded — familyId:', profile?.family_id, 'role:', profile?.role, 'name:', profile?.display_name);
          setProfile(profile);
        } catch (err) {
          debug.error('RootLayout', 'failed to load profile:', err);
        }
      }
      setLoading(false);
      debug.log('RootLayout', 'auth bootstrap complete');
    }).catch((err) => {
      debug.error('RootLayout', 'getSession FAILED:', err);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      debug.log('RootLayout', 'onAuthStateChange — event:', event, 'hasSession:', !!session, 'userId:', session?.user?.id);
      setSession(session);
      if (session?.user) {
        try {
          const profile = await api.getProfile(session.user.id);
          debug.log('RootLayout', 'auth change profile — familyId:', profile?.family_id);
          setProfile(profile);
        } catch (err) {
          debug.error('RootLayout', 'auth change profile load FAILED:', err);
        }
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const [fontsLoaded, fontError] = useFonts({
    // TODO: Add actual font files to assets/fonts/
    // 'PlayfairDisplay-Regular': require('@/assets/fonts/PlayfairDisplay-Regular.ttf'),
    // 'PlayfairDisplay-Medium': require('@/assets/fonts/PlayfairDisplay-Medium.ttf'),
    // 'PlayfairDisplay-Bold': require('@/assets/fonts/PlayfairDisplay-Bold.ttf'),
    // 'PlayfairDisplay-Italic': require('@/assets/fonts/PlayfairDisplay-Italic.ttf'),
    // 'SourceSans3-Regular': require('@/assets/fonts/SourceSans3-Regular.ttf'),
    // 'SourceSans3-Medium': require('@/assets/fonts/SourceSans3-Medium.ttf'),
    // 'SourceSans3-SemiBold': require('@/assets/fonts/SourceSans3-SemiBold.ttf'),
    // 'SourceSans3-Bold': require('@/assets/fonts/SourceSans3-Bold.ttf'),
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: semantic.background },
            animation: 'fade',
          }}
        />
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: semantic.background,
  },
});
