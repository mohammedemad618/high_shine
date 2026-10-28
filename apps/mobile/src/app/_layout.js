import { useEffect } from 'react';
import { I18nManager } from 'react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as ScreenOrientation from 'expo-screen-orientation';
import { StatusBar } from 'expo-status-bar';
import { QueryClientProvider } from '@tanstack/react-query';
import {
  IBMPlexSansArabic_400Regular,
  IBMPlexSansArabic_500Medium,
  IBMPlexSansArabic_600SemiBold,
  IBMPlexSansArabic_700Bold,
  useFonts,
} from '@expo-google-fonts/ibm-plex-sans-arabic';
import { queryClient } from '../lib/queryClient';
import { useAuth } from '../store/auth';
import { colors } from '../theme';

// Arabic UI. Native builds already start in RTL (expo-localization plugin in app.json); this keeps
// JS-side state consistent and covers environments where the native flag was not applied yet.
I18nManager.allowRTL(true);
if (!I18nManager.isRTL) I18nManager.forceRTL(true);

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const status = useAuth((s) => s.status);
  const [fontsLoaded, fontError] = useFonts({
    IBMPlexSansArabic_400Regular,
    IBMPlexSansArabic_500Medium,
    IBMPlexSansArabic_600SemiBold,
    IBMPlexSansArabic_700Bold,
  });
  const fontsReady = fontsLoaded || !!fontError; // a font failure falls back to the system font

  useEffect(() => {
    // Portrait everywhere; the player unlocks landscape for its own full-screen mode.
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    useAuth
      .getState()
      .bootstrap()
      .catch(() => useAuth.getState().clearSession());
  }, []);

  const ready = status !== 'loading' && fontsReady;
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  // Drop cached data from the previous account on logout.
  useEffect(() => {
    if (status === 'signedOut') queryClient.clear();
  }, [status]);

  if (!ready) return null;

  const signedIn = status === 'signedIn';
  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="dark" />
      {/* Every screen draws its own header, as in the design. */}
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="search" options={{ animation: 'fade' }} />
          <Stack.Screen name="course/[id]" />
          <Stack.Screen name="lesson/[id]" options={{ contentStyle: { backgroundColor: colors.player } }} />
          <Stack.Screen name="change-password" options={{ contentStyle: { backgroundColor: colors.card } }} />
          <Stack.Screen name="delete-account" options={{ contentStyle: { backgroundColor: colors.card } }} />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="login" options={{ contentStyle: { backgroundColor: colors.card } }} />
          <Stack.Screen name="register" options={{ contentStyle: { backgroundColor: colors.card } }} />
        </Stack.Protected>
      </Stack>
    </QueryClientProvider>
  );
}
