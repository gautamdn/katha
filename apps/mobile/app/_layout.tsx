import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';
import { semantic } from '@/theme';

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
