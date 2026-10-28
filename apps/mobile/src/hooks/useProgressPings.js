import { useCallback, useEffect, useRef } from 'react';
import { PROGRESS_PING_SECONDS } from '@lp/shared';
import { saveProgress } from '../api/endpoints';
import { queryClient } from '../lib/queryClient';

// A jump bigger than this between two time updates is a seek, not watching.
const MAX_TICK_SEC = 3;

/**
 * Tracks real watch time and reports it with POST /lessons/:id/progress every PROGRESS_PING_SECONDS while
 * playing, on pause and on unmount. The ping also keeps the server-side playback session alive.
 *
 * Feed it with `onTime(currentTime, isPlaying)` from the player's time updates.
 */
export function useProgressPings(lessonId, isPlaying) {
  const positionRef = useRef(null); // null until the player reported a real position
  const lastTimeRef = useRef(null);
  const pendingRef = useRef(0); // watched seconds not yet reported
  const lastSentRef = useRef(null);

  const onTime = useCallback((currentTime, playing) => {
    const last = lastTimeRef.current;
    lastTimeRef.current = currentTime;
    positionRef.current = currentTime;
    if (playing && last !== null) {
      const delta = currentTime - last;
      if (delta > 0 && delta <= MAX_TICK_SEC) pendingRef.current += delta;
    }
  }, []);

  // A seek or source swap: forget the last sample so the jump is not counted.
  const resetClock = useCallback(() => {
    lastTimeRef.current = null;
  }, []);

  const flush = useCallback(() => {
    // Never report before the player had a real position: that would overwrite the saved resume point.
    if (!lessonId || positionRef.current === null) return Promise.resolve();
    const positionSec = Math.max(0, Math.floor(positionRef.current));
    const watchedDeltaSec = Math.floor(pendingRef.current);
    if (watchedDeltaSec === 0 && positionSec === lastSentRef.current) return Promise.resolve();
    pendingRef.current -= watchedDeltaSec;
    lastSentRef.current = positionSec;
    return saveProgress(lessonId, { positionSec, watchedDeltaSec }).catch(() => {
      // Not fatal for playback; give the seconds back so the next ping reports them.
      pendingRef.current += watchedDeltaSec;
      lastSentRef.current = null;
    });
  }, [lessonId]);

  // Periodic ping while playing.
  useEffect(() => {
    if (!isPlaying) return undefined;
    const t = setInterval(flush, PROGRESS_PING_SECONDS * 1000);
    return () => clearInterval(t);
  }, [isPlaying, flush]);

  // Ping on pause.
  const wasPlaying = useRef(false);
  useEffect(() => {
    if (wasPlaying.current && !isPlaying) flush();
    wasPlaying.current = isPlaying;
  }, [isPlaying, flush]);

  // Final ping on exit, then refresh the screens that show progress.
  useEffect(
    () => () => {
      flush().finally(() => {
        queryClient.invalidateQueries({ queryKey: ['course'] });
        queryClient.invalidateQueries({ queryKey: ['me', 'courses'] });
      });
    },
    [flush],
  );

  return { onTime, resetClock, flush, positionRef };
}
