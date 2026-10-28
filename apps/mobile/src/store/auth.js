import { create } from 'zustand';
import * as secure from '../lib/secureStorage';

/**
 * Session state. Tokens live in expo-secure-store; this store mirrors them in memory so the API client
 * can read them synchronously. `status` drives the route guards in the root layout.
 */
export const useAuth = create((set) => ({
  status: 'loading', // 'loading' | 'signedOut' | 'signedIn'
  accessToken: null,
  refreshToken: null,
  user: null,

  async bootstrap() {
    const { accessToken, refreshToken } = await secure.readTokens();
    set(refreshToken ? { status: 'signedIn', accessToken, refreshToken } : { status: 'signedOut' });
  },

  // AuthResult from login / register / refresh: {user, accessToken, refreshToken}
  async setTokens({ user, accessToken, refreshToken }) {
    await secure.writeTokens({ accessToken, refreshToken });
    set((s) => ({ status: 'signedIn', accessToken, refreshToken, user: user ?? s.user }));
  },

  setUser(user) {
    set({ user });
  },

  // Clears the tokens only; the deviceId stays so the next login reuses the same device slot.
  async clearSession() {
    await secure.clearTokens();
    set({ status: 'signedOut', accessToken: null, refreshToken: null, user: null });
  },
}));
