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

/** Stable per-install id, generated once. Accounts are limited to N devices, so it must not change. */
export function getDeviceId() {
  if (!deviceIdPromise) {
    deviceIdPromise = (async () => {
      const existing = await SecureStore.getItemAsync(KEYS.deviceId, OPTIONS);
      if (existing) return existing;
      const id = Crypto.randomUUID();
      await SecureStore.setItemAsync(KEYS.deviceId, id, OPTIONS);
      return id;
    })().catch((err) => {
      deviceIdPromise = null;
      throw err;
    });
  }
  return deviceIdPromise;
}
