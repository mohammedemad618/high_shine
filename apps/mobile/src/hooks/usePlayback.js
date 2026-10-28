import { useCallback, useEffect, useRef, useState } from 'react';
import { startPlayback } from '../api/endpoints';

// Renew the playback token this long before it expires so a long session never hits a dead link.
const RENEW_BEFORE_MS = 2 * 60 * 1000;

/**
 * POST /lessons/:id/playback, plus renewal. `reload()` asks for a fresh playback (new token, new signed
 * attachment links); it is called on player errors and shortly before `expiresAt`.
 */
export function usePlayback(lessonId) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const inFlight = useRef(null);

  const load = useCallback(
    (silent = false) => {
      if (inFlight.current) return inFlight.current;
      if (!silent) setState((s) => ({ ...s, loading: true, error: null }));
      inFlight.current = startPlayback(lessonId)
        .then((data) => {
          setState({ data, error: null, loading: false });
          return data;
        })
        .catch((error) => {
          setState((s) => ({ ...s, error, loading: false }));
          return null;
        })
        .finally(() => {
          inFlight.current = null;
        });
      return inFlight.current;
    },
    [lessonId],
  );

  useEffect(() => {
    load();
  }, [load]);

  // Proactive renewal before the token expires.
  const expiresAt = state.data?.expiresAt;
  useEffect(() => {
    if (!expiresAt) return undefined;
    const ms = new Date(expiresAt).getTime() - Date.now() - RENEW_BEFORE_MS;
    const t = setTimeout(() => load(true), Math.max(ms, 10 * 1000));
    return () => clearTimeout(t);
  }, [expiresAt, load]);

  return { ...state, reload: load };
}
