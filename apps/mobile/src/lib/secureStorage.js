import { Platform } from 'react-native';
import * as Application from 'expo-application';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const KEYS = {
  accessToken: 'lp.accessToken',
  refreshToken: 'lp.refreshToken',
  deviceId: 'lp.deviceId',
};

// Tokens are only needed while the device is unlocked; they never leave this device via backups.
const OPTIONS = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

export async function readTokens() {
  const [accessToken, refreshToken] = await Promise.all([
    SecureStore.getItemAsync(KEYS.accessToken, OPTIONS),
    SecureStore.getItemAsync(KEYS.refreshToken, OPTIONS),
  ]);
  return { accessToken, refreshToken };
}

export async function writeTokens({ accessToken, refreshToken }) {
  await Promise.all([
    SecureStore.setItemAsync(KEYS.accessToken, accessToken, OPTIONS),
    SecureStore.setItemAsync(KEYS.refreshToken, refreshToken, OPTIONS),
  ]);
}

export async function clearTokens() {
  await Promise.all([
    SecureStore.deleteItemAsync(KEYS.accessToken, OPTIONS),
    SecureStore.deleteItemAsync(KEYS.refreshToken, OPTIONS),
  ]);
}

let deviceIdPromise = null;

// Android wipes app storage on uninstall, so a random id would take a new device slot after every reinstall.
// ANDROID_ID stays the same for this app on this phone across reinstalls; it is hashed before leaving the device.
// iOS keeps Keychain items after uninstall, so a random id already survives there.
async function newDeviceId() {
  const androidId = Platform.OS === 'android' ? Application.getAndroidId() : null;
  if (!androidId) return Crypto.randomUUID();
  const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `lp-device:${androidId}`);
  return `a-${digest.slice(0, 32)}`;
}

/**
 * Stable device id. Accounts are limited to N devices, so it must not change. An id stored by an earlier
 * version is kept, so devices already bound to an account keep their slot.
 */
export function getDeviceId() {
  if (!deviceIdPromise) {
    deviceIdPromise = (async () => {
      const existing = await SecureStore.getItemAsync(KEYS.deviceId, OPTIONS);
      if (existing) return existing;
      const id = await newDeviceId();
      await SecureStore.setItemAsync(KEYS.deviceId, id, OPTIONS);
      return id;
    })().catch((err) => {
      deviceIdPromise = null;
      throw err;
    });
  }
  return deviceIdPromise;
}
