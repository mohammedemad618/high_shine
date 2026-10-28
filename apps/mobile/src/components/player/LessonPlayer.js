import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useEvent, useEventListener } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useProgressPings } from '../../hooks/useProgressPings';
import { colors, spacing } from '../../theme';
import { Icon, T } from '../ui';
import { AUTO_QUALITY } from './PlayerOptions';
import { PlayerControls } from './PlayerControls';
import { Watermark } from './Watermark';

// Wait at least this long between automatic recoveries after a player error (e.g. an expired token).
const RECOVERY_COOLDOWN_MS = 15 * 1000;

/**
 * The master playlist carries every rendition; a single variant lives next to it as v<index>/index.m3u8
 * (index = position in `renditions`, as written by the worker). Choosing a variant pins the quality.
 */
function sourceFor(playbackUrl, renditions, quality) {
  const index = quality === AUTO_QUALITY ? -1 : renditions.findIndex((r) => r.name === quality);
  const uri = index < 0 ? playbackUrl : playbackUrl.replace('/master.m3u8', `/v${index}/index.m3u8`);
  return { uri, contentType: 'hls' };
}

/**
 * Video + watermark + custom controls. Progress pings run inside.
 *
 * Props: playback (POST /lessons/:id/playback response), startAt (seconds), fullscreen, speed, quality,
 * onExpired() to request a fresh playback, onTakenOver() when another device took the account over,
 * header (full-screen top bar), children (drawn over the video).
 */
export function LessonPlayer({ playback, startAt, fullscreen, speed, quality, onExpired, onTakenOver, header, children }) {
  const { lesson, playbackUrl, renditions = [], watermark } = playback;
  const source = useMemo(() => sourceFor(playbackUrl, renditions, quality), [playbackUrl, renditions, quality]);

  const player = useVideoPlayer(null, (p) => {
    p.timeUpdateEventInterval = 1;
    p.staysActiveInBackground = false;
    // AirPlay would send the clean stream to a TV, without the watermark (iOS only; ignored elsewhere).
    p.allowsExternalPlayback = false;
  });

  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  const { status, error } = useEvent(player, 'statusChange', { status: player.status });
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(playback.durationSec || 0);

  const takenOver = useCallback(() => {
    player.pause();
    onTakenOver?.();
  }, [player, onTakenOver]);
  const pings = useProgressPings(lesson.id, isPlaying, takenOver);
  // Where to seek once the next source is ready; null once applied.
  const pendingSeek = useRef(startAt || 0);
  const wantPlay = useRef(true);
  const lastRecovery = useRef(0);

  // (Re)load the source: first load, quality change, or a renewed playback token.
  useEffect(() => {
    if (pings.positionRef.current !== null) pendingSeek.current = pings.positionRef.current;
    wantPlay.current = wantPlay.current || player.playing;
    pings.resetClock();
    player.replaceAsync(source).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, player]);

  useEffect(() => {
    if (status !== 'readyToPlay') return;
    if (player.duration) setDuration(player.duration);
    if (pendingSeek.current === null) return;
    if (pendingSeek.current > 0) {
      player.currentTime = pendingSeek.current;
      setTime(pendingSeek.current);
    }
    pendingSeek.current = null;
    player.playbackRate = speed;
    if (wantPlay.current) player.play();
    wantPlay.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, player]);

  useEventListener(player, 'timeUpdate', ({ currentTime }) => {
    if (pendingSeek.current !== null) return; // still positioning the new source
    setTime(currentTime);
    pings.onTime(currentTime, player.playing);
  });

  // A failed load usually means the playback token expired: ask for a new one (rate-limited).
  useEffect(() => {
    if (status !== 'error') return;
    const now = Date.now();
    if (now - lastRecovery.current < RECOVERY_COOLDOWN_MS) return;
    lastRecovery.current = now;
    wantPlay.current = true;
    onExpired?.();
  }, [status, error, onExpired]);

  useEffect(() => {
    player.playbackRate = speed;
  }, [player, speed]);

  const seek = useCallback(
    (sec) => {
      pings.resetClock();
      player.currentTime = sec;
      setTime(sec);
    },
    [player, pings],
  );
  const playPause = useCallback(() => (player.playing ? player.pause() : player.play()), [player]);

  return (
    <View style={fullscreen ? styles.videoFull : styles.video}>
      <VideoView
        style={StyleSheet.absoluteFill}
        player={player}
        nativeControls={false}
        contentFit="contain"
        // Native full screen and PiP would leave the watermark behind; full screen is handled by the screen.
        fullscreenOptions={{ enable: false }}
        allowsPictureInPicture={false}
      />
      <Watermark text={watermark?.text} />
      {status === 'error' ? (
        <Pressable
          accessibilityRole="button"
          style={styles.errorOverlay}
          onPress={() => {
            wantPlay.current = true;
            onExpired?.();
          }}
        >
          <Icon name="refresh-cw" size={28} color={colors.white} />
          <T weight="medium" size={14} color={colors.white} style={styles.center}>
            تعذّر تشغيل الفيديو، اضغط لإعادة المحاولة
          </T>
        </Pressable>
      ) : (
        <PlayerControls
          isPlaying={isPlaying}
          time={time}
          duration={duration}
          fullscreen={fullscreen}
          onPlayPause={playPause}
          onSeek={seek}
          header={header}
        />
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  video: { width: '100%', aspectRatio: 16 / 9, backgroundColor: colors.playerSurface },
  videoFull: { flex: 1, backgroundColor: colors.black },
  errorOverlay: {
    // RN 0.88 dropped absoluteFillObject; absoluteFill is a plain object now.
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
  },
  center: { textAlign: 'center' },
});
