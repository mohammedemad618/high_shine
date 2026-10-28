import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { useIsFocused } from 'expo-router';
import * as ScreenCapture from 'expo-screen-capture';

const KEY = 'lesson-player';

/**
 * Screen protection while the player screen is focused.
 * - Android: preventScreenCaptureAsync sets FLAG_SECURE, which blocks screenshots and recordings.
 * - iOS: the same call makes expo-screen-capture cover the window natively while the screen is being
 *   recorded or mirrored (UIScreen.capturedDidChangeNotification) and hides content from screenshots on
 *   iOS 13+. The installed version (58.0.x) exposes no JS recording-state event, so the JS side only
 *   listens for screenshots and reports them with `screenshotTaken`.
 */
export function useScreenProtection() {
  const focused = useIsFocused();
  const [screenshotTaken, setScreenshotTaken] = useState(false);

  useEffect(() => {
    if (!focused) return undefined;
    ScreenCapture.preventScreenCaptureAsync(KEY).catch(() => {});
    return () => {
      ScreenCapture.allowScreenCaptureAsync(KEY).catch(() => {});
    };
  }, [focused]);

  useEffect(() => {
    if (!focused || Platform.OS !== 'ios') return undefined;
    const sub = ScreenCapture.addScreenshotListener(() => setScreenshotTaken(true));
    return () => sub.remove();
  }, [focused]);

  const dismissScreenshotNotice = useCallback(() => setScreenshotTaken(false), []);
  return { screenshotTaken, dismissScreenshotNotice };
}
