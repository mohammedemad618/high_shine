'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as client from '@/lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // `ready` stays false until localStorage has been read, so server and first client render match.
  const [state, setState] = useState({ user: null, ready: false, reason: null });

  useEffect(() => {
    setState({ user: client.getStoredUser(), ready: true, reason: null });

    const off = client.onSessionChange((event) => {
      setState({ user: event.user, ready: true, reason: event.type === 'logout' ? event.reason : null });
    });
    // Login/logout in another tab.
    const onStorage = (e) => {
      if (e.key === null || client.SESSION_STORAGE_KEYS.includes(e.key)) {
        setState((s) => ({ ...s, user: client.getStoredUser(), ready: true }));
      }
    };
    window.addEventListener('storage', onStorage);
    return () => {
      off();
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const logout = useCallback(() => client.logout(), []);

  const value = useMemo(
    () => ({
      user: state.user,
      ready: state.ready,
      logoutReason: state.reason,
      login: client.login,
      register: client.register,
      logout,
      setUser: client.updateStoredUser,
    }),
    [state, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
